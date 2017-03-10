const filewatcher = require('filewatcher');
const argv = require('minimist')(process.argv.slice(2));
const execSync = require('child_process').exec;
const sanitize = require('sanitize-filename');

function moveOldDeployFile() {
  const currentDate = sanitize(new Date().toISOString(), { replacement: '-' });
  const retireDirname = `retired-${currentDate}`;

  execSync('mkdir', ['-p', 'old_releases', retireDirname]);
  execSync('mv', ['gakusei.production.jar', 'nohup.out', `${retireDirname}/`]);
  execSync('mv', ['gakusei-*.jar.to.deploy', 'gakusei.production.jar']);

    // Kill running server
  execSync('pkill', ['-9', '-f', 'gakusei-*.jar']);
  execSync('nohup', ['gakusei.production.jar', '&']);
}

// main
if (argv.filename) {
  const watcher = filewatcher();

// watch a file
  watcher.add(argv.filename);

  watcher.on('change', (file, stat) => {
    if (stat) {
      console.log('New deploy file detected: %s', file);
      //moveOldDeployFile();
    } else {
      console.log('.to.deploy file was deleted, carry on..');
    }
  });
} else {
  console.log("You did not specify a filename to watch for, so I can't deploy new files..");
}

