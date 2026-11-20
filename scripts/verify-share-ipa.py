"""Inspect the native extension actually packaged for an iPhone, including Debug dylibs."""
import argparse
import json
import plistlib
import zipfile


def check_share(ipa):
    with zipfile.ZipFile(ipa) as archive:
        matches = [p for p in archive.namelist()
                   if p.startswith("Payload/") and p.endswith(".app/PlugIns/TTodoShare.appex/Info.plist")]
        if len(matches) != 1:
            raise ValueError("Expected one embedded TTodoShare extension")
        folder, _ = matches[0].rsplit("/", 1)
        info = plistlib.loads(archive.read(matches[0]))
        extension = info["NSExtension"]
        if (extension["NSExtensionPointIdentifier"] != "com.apple.share-services"
                or extension["NSExtensionPrincipalClass"] != "TTodoShare.ShareViewController"):
            raise ValueError("Incorrect share extension entry point")
        executable = info["CFBundleExecutable"]
        code = [archive.read(f"{folder}/{executable}")]
        debug_library = f"{folder}/{executable}.debug.dylib"
        if debug_library in archive.namelist():
            code.append(archive.read(debug_library))
        if any(b"ttodo://share-import?fallback=pasteboard" in binary for binary in code):
            raise ValueError("This IPA contains the old pasteboard/URL handoff")
        if not any(b"ttodo-share-review-entry" in binary for binary in code):
            raise ValueError("The packaged extension lacks the new share review screen")
        app = folder.rsplit("/PlugIns/", 1)[0]
        metadata = json.loads(archive.read(f"{app}/Metadata.appintents/extract.actionsdata"))
        if "ReviewSharedImageIntent" not in metadata["actions"]:
            raise ValueError("Shortcuts cannot discover the foreground image review action in this IPA")
        return info["CFBundleIdentifier"], info["CFBundleVersion"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("ipa")
    args = parser.parse_args()
    try:
        bundle, build = check_share(args.ipa)
        print(f"Verified share entry in {bundle}, build {build}")
    except (OSError, KeyError, ValueError, zipfile.BadZipFile, plistlib.InvalidFileException) as error:
        parser.exit(1, f"Share extension check failed: {error}\n")
