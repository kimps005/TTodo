Pod::Spec.new do |s|
  s.name = 'TTodoNative'
  s.version = '0.1.0'
  s.summary = 'TTodo shared storage, OCR and Live Activity bridge'
  s.description = s.summary
  s.author = 'kimps005'
  s.homepage = 'https://github.com/kimps005/TTodo'
  s.license = { :type => 'Proprietary' }
  s.platforms = { :ios => '18.0' }
  s.source = { :git => 'https://github.com/kimps005/TTodo.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'WidgetKit', 'ActivityKit', 'ImageIO'
  s.libraries = 'sqlite3'
  s.swift_version = '5.9'
  s.source_files = '**/*.swift'
end
