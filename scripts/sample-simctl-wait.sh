#!/bin/bash
# The parent cancels this read when the probe finishes promptly.
if read -r -t 12; then exit 0; fi
parent=$1
prefix=$2
ps -axo pid=,ppid=,comm= > "$prefix.processes.txt" || exit 1
# Sample only the measured child and its descendants on this CI host.
awk -v parent="$parent" -v observer="$$" '
  { ppid[$1]=$2 }
  END {
    for (pid in ppid) {
      ancestor=pid
      while (ancestor in ppid && ancestor != parent && ancestor != observer && ancestor > 1)
        ancestor=ppid[ancestor]
      if (ancestor == parent && pid != parent) print pid
    }
  }
' "$prefix.processes.txt" | while read -r pid; do
  /usr/bin/sample "$pid" 1 -file "$prefix.$pid.sample.txt" >> "$prefix.sample.log" 2>&1 &
done
