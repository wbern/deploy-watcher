const filewatcher = require('filewatcher');
const argv = require('minimist')(process.argv.slice(2));
const execSync = require('child_process').execSync;
const sanitize = require('sanitize-filename');
const fs = require('fs');
const util = require('util');

// logging wrapper
const logFile = fs.createWriteStream(`${__dirname}/debug.log`, { flags: 'a' });
const logStdout = process.stdout;
console.log = function (d) { //
  logFile.write(`${util.format(d)}\n`);
  logStdout.write(`${util.format(d)}\n`);
};

function moveOldDeployFile() {
  const currentDate = sanitize(new Date().toISOString(), { replacement: '-' });
  const retireDirname = `old_releases/retired-${currentDate}`;

  execSync('mkdir', ['-p', retireDirname]);
  execSync('mv', [argv.productionfilename, 'nohup.out', `${retireDirname}/`]);
  execSync('mv', [argv.filename, argv.productionfilename]);

  // Kill running server
  execSync('pkill', ['-9', '-f', 'gakusei*.jar']);
  execSync('nohup', ['java', '-jar', argv.productionfilename, '&']);
}

// main()
if (argv.filename) {
  // the default options
  const opts = {
    forcePolling: false,  // try event-based watching first
    debounce: 10,         // debounce events in non-polling mode by 10ms
    interval: 1000,       // if we need to poll, do it every 1000ms
    persistent: true,      // don't end the process while files are watched
  };

  const watcher = filewatcher(opts);
  console.log(`Watching for file changes in file: ${argv.filename}`);

  // watch a file
  watcher.add(argv.filename);

  watcher.on('change', (file, stat) => {
    if (stat) {
      console.log(`New deploy file detected: ${file}`);
      moveOldDeployFile();
    } else {
      console.log('.to.deploy file was deleted, carry on..');
    }
  });
} else {
  console.log("You did not specify a filename to watch for, so I can't deploy new files..");
}
