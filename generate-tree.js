const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = __dirname;
const OUTPUT = path.join(ROOT, 'tree.json');


/* =========================================================
   READ FRONT MATTER
   ========================================================= */

function readFrontMatter(filePath) {
  const markdown = fs.readFileSync(
    filePath,
    'utf8'
  );

  const match = markdown.match(
    /^---\s*\n([\s\S]*?)\n---\s*\n/
  );

  if (!match) {
    return {};
  }

  const frontMatter = match[1];

  try {
    return yaml.load(frontMatter) || {};
  } catch (error) {
    console.warn(
      `Could not parse front matter in ${filePath}`
    );

    console.warn(error.message);

    return {};
  }
}


/* =========================================================
   BUILD TREE
   ========================================================= */

function buildTree(currentPath, relativePath = '') {
  const entries = fs
    .readdirSync(currentPath, {
      withFileTypes: true
    })
    .filter((entry) => {
      /*
       * Don't include GitHub Actions,
       * node_modules, or the generated tree itself.
       */

      if (entry.name === 'node_modules') {
        return false;
      }

      if (entry.name === '.git') {
        return false;
      }

      if (entry.name === '.github') {
        return false;
      }

      if (entry.name === 'tree.json') {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      /*
       * Folders first, then files.
       */

      if (
        a.isDirectory() &&
        !b.isDirectory()
      ) {
        return -1;
      }

      if (
        !a.isDirectory() &&
        b.isDirectory()
      ) {
        return 1;
      }

      return a.name.localeCompare(
        b.name
      );
    });


  return entries.map((entry) => {

    const absolutePath =
      path.join(
        currentPath,
        entry.name
      );

    const entryRelativePath =
      relativePath
        ? path.join(
            relativePath,
            entry.name
          )
        : entry.name;


    /*
     * FOLDER
     */

    if (entry.isDirectory()) {

      return {
        type: 'folder',

        name: entry.name,

        path: entryRelativePath
          .replace(/\\/g, '/'),

        children: buildTree(
          absolutePath,
          entryRelativePath
        )
      };
    }


    /*
     * FILE
     */

    const node = {
      type: 'file',

      name: entry.name,

      path: entryRelativePath
        .replace(/\\/g, '/')
    };


    /*
     * Markdown metadata
     */

    if (
      entry.name
        .toLowerCase()
        .endsWith('.md')
    ) {

      const metadata =
        readFrontMatter(
          absolutePath
        );


      /*
       * Put ALL YAML fields
       * directly on the tree node.
       */

      Object.assign(
        node,
        metadata
      );
    }


    return node;
  });
}


/* =========================================================
   GENERATE
   ========================================================= */

const tree = {
  type: 'folder',

  name: path.basename(ROOT),

  path: '',

  children: buildTree(ROOT)
};


fs.writeFileSync(
  OUTPUT,

  JSON.stringify(
    tree,
    null,
    2
  ) + '\n',

  'utf8'
);


console.log(
  'tree.json generated successfully.'
);