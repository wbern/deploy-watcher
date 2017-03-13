const filewatcher = require('filewatcher');
const argv = require('minimist')(process.argv.slice(2));
const execSync = require('child_process').execSync;
const spawn = require('child_process').spawn;
const sanitize = require('sanitize-filename');
const fs = require('fs');
const util = require('util');

// logging wrapper
process.chdir(process.env.HOME);
const logFile = fs.createWriteStream(`${__dirname}/debug.log`, { flags: 'a' });
const logStdout = process.stdout;
console.log = function (d) { //
  logFile.write(`${util.format(d)}\n`);
  logStdout.write(`${util.format(d)}\n`);
};

function execSyncEx(command) {
  const result = execSync(command, [], { stdio: 'inherit' });
  console.log(result.toString('utf8'));
}

function moveOldDeployFile() {
  const currentDate = sanitize(new Date().toISOString(), { replacement: '-' });
  const retireDirname = `old_releases/retired-${currentDate}`;

  try {
    // Move old production files
    execSyncEx(`mkdir -pv ${retireDirname}`);
    execSyncEx(`mv -vf ${argv.productionfilename} server.log ${retireDirname}/`);
    execSyncEx(`mv -vf ${argv.filename} ${argv.productionfilename}`);

    // Kill running server & start a new one
    execSyncEx('pkill -9 -f gakusei.*.jar');

    // DB backup
    execSyncEx(`pg_dump -U gakusei -h 127.0.0.1 -o gakusei > ${retireDirname}/db_backup_${currentDate}.sql`);

    // Run new instance
    execSyncEx(`nohup java -jar ${argv.productionfilename} &> server.log&`);
  } catch (err) {
    console.log('Failed to replace currently deployed application.');
    console.log(err);
  }
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
      console.log('Finished change in production.');
    } else {
      console.log('.to.deploy file was deleted, carry on..');
    }
  });
} else {
  console.log("You did not specify a filename to watch for, so I can't deploy new files..");
}
