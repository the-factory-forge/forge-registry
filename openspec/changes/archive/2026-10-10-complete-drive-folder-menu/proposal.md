## Why

The highlighted folder menu reference includes child-folder creation and downloads.
The existing menu already supplies file/directory uploads, rename and duplication.

## What changes

- Add child-folder creation to Add, independently of upload permission.
- Download the selected folder as a bounded ZIP using existing authorized reads.
- Preserve failure feedback, keyboard and touch access, and installed client compatibility.

## Impact

The owning change root is forge-spec. forge-registry owns the implementation,
tests, guides and generated Drive distribution. Drive-storage and Menus inherit
Drive. Terminal60 is the recorded consumer and needs a reviewed source refresh;
consumer adoption and deployment are outside this task. These are basic file
browser operations, with no new host workflow, transport method or schema.
