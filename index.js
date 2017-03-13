const filewatcher = require('filewatcher');
const execSync = require('child_process').execSync;
const sanitize = require('sanitize-filename');
const fs = require('fs');
const util = require('util');

// Environment variables & other things
const vars = {
  appLogfile: process.env.DW_APP_LOGFILE || 'server.log',
  deployingFilename: process.env.DW_DEPLOY_FILENAME,
  prodFilename: process.env.DW_PROD_FILENAME,
  scriptLogfile: process.env.DW_SCRIPT_LOGFILE,
  cwd: process.env.DW_CWD,
  dbUser: process.env.DW_DB_USER,
  dbHost: process.env.DW_DB_HOST,
  dbOid: process.env.DW_DB_OID,
  pKillProcessText: process.env.DW_PKILL_TEXT,
  currentDate: sanitize(new Date().toISOString(), { replacement: '-' }),
};
vars.retireDirname = `old_releases/retired-${vars.currentDate}`;

vars.forEach((currentValue) => {
  if (!currentValue) {
    throw new Error('One or more environment variables not set. Exiting!');
  }
});

// Set up logging and working directory
process.chdir(vars.cwd);
const logFile = fs.createWriteStream(`${vars.scriptLogfile}`, { flags: 'a' });
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
    execSyncEx(`mkdir -pv ${vars.retireDirname}`);

    execSyncEx(`touch ${vars.appLogfile} && mv -vf ${vars.appLogfile} ${vars.retireDirname}/`); // fail silently
    execSyncEx(`mv -vf ${vars.prodFilename} ${vars.retireDirname}/`);
    execSyncEx(`mv -vf ${vars.deployingFilename} ${vars.prodFilename}`);

    // Kill running server & start a new one
    execSyncEx(`pkill -9 -f "${vars.pKillProcessText}"`);

    // DB backup
    execSyncEx(`pg_dump -U ${vars.dbUser} -h ${vars.dbHost} -o ${vars.dbOid} > ${vars.retireDirname}/db_backup_${vars.currentDate}.sql`);

    // Run new instance
    execSyncEx(`nohup java -jar ${vars.prodFilename} &> ${vars.appLogfile}&`);
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

console.log(`Watching for file changes in file: ${vars.deployingFilename}`);
watcher.add(vars.deployingFilename);

watcher.on('change', (file, stat) => {
  if (stat) {
    console.log(`New deploy file detected: ${file}`);
    moveOldDeployFile();
    console.log('Finished change in production.');
  } else {
    console.log('.to.deploy file was deleted, carry on..');
  }
});
