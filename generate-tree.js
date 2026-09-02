import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

const IGNORE = new Set([
  '.git',
  '.github',
  'node_modules',
  'tree.json',
  'generate-tree.js'
]);


function buildTree(directory, relativePath = '') {

  const entries = fs.readdirSync(directory, {
    withFileTypes: true
  });

  const folders = [];
  const files = [];


  for (const entry of entries) {

    if (IGNORE.has(entry.name)) {
      continue;
    }

    const fullPath =
      path.join(directory, entry.name);

    const repoPath =
      path.join(relativePath, entry.name)
        .replaceAll('\\', '/');


    if (entry.isDirectory()) {

      folders.push({
        type: 'folder',
        name: entry.name,
        path: repoPath,
        children: buildTree(
          fullPath,
          repoPath
        )
      });

    } else if (entry.isFile()) {

      files.push({
        type: 'file',
        name: entry.name,
        path: repoPath
      });

    }
  }


  folders.sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  files.sort((a, b) =>
    a.name.localeCompare(b.name)
  );


  return [
    ...folders,
    ...files
  ];
}


const tree = {
  type: 'folder',
  name: 'blog-content',
  path: '',
  children: buildTree(ROOT)
};


fs.writeFileSync(
  path.join(ROOT, 'tree.json'),
  JSON.stringify(tree, null, 2),
  'utf8'
);


console.log('tree.json generated successfully.');