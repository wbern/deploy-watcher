const filewatcher = require('filewatcher');
const execSync = require('child_process').execSync;
const sanitize = require('sanitize-filename');
const fs = require('fs');
const util = require('util');

// Environment variables & other things
const deployingFilename = process.env.DW_DEPLOY_FILENAME;
const prodFilename = process.env.DW_PROD_FILENAME;
const scriptLogfile = process.env.DW_SCRIPT_LOGFILE;
const cwd = process.env.DW_CWD;
const dbUser = process.env.DW_DB_USER;
const dbHost = process.env.DW_DB_HOST;
const dbOid = process.env.DW_DB_OID;
const pKillProcessText = process.env.DW_PKILL_TEXT;
const currentDate = sanitize(new Date().toISOString(), { replacement: '-' });
const retireDirname = `old_releases/retired-${currentDate}`;

// Set up logging and working directory
process.chdir(cwd);
const logFile = fs.createWriteStream(`${scriptLogfile}`, { flags: 'a' });
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
  try {
    // Move old production files
    execSyncEx(`mkdir -pv ${retireDirname}`);
    execSyncEx(`mv -vf server.log ${retireDirname}/ 2>/dev/null`); // fail silently
    execSyncEx(`mv -vf ${prodFilename} server.log ${retireDirname}/`);
    execSyncEx(`mv -vf ${deployingFilename} ${prodFilename}`);

    // Kill running server & start a new one
    execSyncEx(`pkill -9 -f "${pKillProcessText}"`);

    // DB backup
    execSyncEx(`pg_dump -U ${dbUser} -h ${dbHost} -o ${dbOid} > ${retireDirname}/db_backup_${currentDate}.sql`);

    // Run new instance
    execSyncEx(`nohup java -jar ${prodFilename} &> server.log&`);
  } catch (err) {
    console.log('Failed to replace currently deployed application.');
    console.log(err);
  }
}

// main()
const watcher = filewatcher({
  forcePolling: false,  // try event-based watching first
  debounce: 10,         // debounce events in non-polling mode by 10ms
  interval: 1000,       // if we need to poll, do it every 1000ms
  persistent: true,      // don't end the process while files are watched
});

console.log(`Watching for file changes in file: ${deployingFilename}`);
watcher.add(deployingFilename);

watcher.on('change', (file, stat) => {
  if (stat) {
    console.log(`New deploy file detected: ${file}`);
    moveOldDeployFile();
    console.log('Finished change in production.');
  } else {
    console.log('.to.deploy file was deleted, carry on..');
  }
});
