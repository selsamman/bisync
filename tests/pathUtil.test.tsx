import * as fs from 'fs';
const fsp = fs.promises;

import { getMirroredPath, isFileContainedInOther } from "../pathUtil";

// TODO: decide how to deal with non-existin files (can you know if theyre dir or file?)
describe("Info object creation", async () => {
    it ("Existing file/dirs", async () => {
        // create test/file1
        // create 'test/' Info - is dir, not deleted, compare stats etc.
        // create 'test/file1' Info - is file, compare stats etc..

    });

    it ("Non-existing", async () => {
        // create 'missingDir/' Info - is
    });
});

describe("Mirror Files", () => {
    it("", async () => {
        
    });
});

describe("Files Pattern Matching", async () => {
    it ("Simple file->file match", async () => {
        // test/asdfg matches test/asdf
        // test/asdfg doesnt match test/asd
        // test/asdfg doesnt match test/asdfg
        // test/asdfg doesnt match test2/asdf
    });

    it ("File doesn't match dir with same name", async () => {
        // test/asdf (file) doesnt match test/asdf (dir)
    });

    it ("File parent dir", async () => {
        // test/asdfg matches  test/
        // test/asdfg doesn't match test2/
    });

    it ("File matches ancestor dirs", async () => {
        // test grandparent dir
        // test drive root / root dir
    });
});
