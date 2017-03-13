const execSync = require('child_process').execSync;
const sanitize = require('sanitize-filename');
const fs = require('fs');
const util = require('util');

// Environment variables & other things
const vars = {
  scriptMode: process.env.DW_SCRIPT_MODE,
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
if (vars.scriptMode === 'backup') {
  vars.backupDirname = `backups/${vars.currentDate}-from-backup`;
} else {
  vars.backupDirname = `backups/${vars.currentDate}-from-deploy-backup`;
}

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
  console.log(result.toString('utf8').replace(/\n$/, ''));
}

function start() {
  if (!vars.prodFilename || !vars.appLogfile) { throw new Error('Variables missing. Exiting.'); }

  execSyncEx(`nohup java -jar ${vars.prodFilename} &> ${vars.appLogfile}&`, [], { stdio: 'inherit' });
}

function stop() {
  if (!vars.pKillProcessText) { throw new Error('Variables missing. Exiting.'); }

  try {
    execSync(`killall -w -u ec2-user -r "${vars.pKillProcessText}"`, [], { stdio: 'inherit' });
  } catch (err) {
    // Ignore errors here, probably just that the process was not running
    return '';
  }
  return '';
}

function backup() {
  if (!vars.appLogfile || !vars.prodFilename || !vars.dbHost || !vars.dbUser || !vars.dbOid) { throw new Error('Variables missing. Exiting.'); }

  execSyncEx(`mkdir -pv ${vars.backupDirname}`);
  execSyncEx(`touch ${vars.appLogfile} && cp -vf ${vars.appLogfile} ${vars.backupDirname}/`); // fail silently
  execSyncEx(`cp -vf ${vars.prodFilename} ${vars.backupDirname}/`);
  execSyncEx(`pg_dump -U ${vars.dbUser} -h ${vars.dbHost} -o ${vars.dbOid} > ${vars.backupDirname}/db_backup_${vars.currentDate}.sql`);
  execSyncEx(`wc -c ${vars.backupDirname}/db_backup_${vars.currentDate}.sql`);
}

function deploy() {
  // Because deployments are important
  for (const currentValue in vars) {
    if (!currentValue) {
      throw new Error('One or more environment variables not set. Exiting!');
    }
  }

  backup();

  // deploying
  execSyncEx(`mv -vf ${vars.deployingFilename} ${vars.prodFilename}`);

  stop();
  start();
}

switch (vars.scriptMode) {
  case 'deploy':
    deploy();
    break;
  case 'backup':
    backup();
    break;
  case 'stop':
    stop();
    break;
  case 'start':
    start();
    break;
  case 'restart':
    stop();
    start();
    break;
  default:
    console.log('No mode specified, doing nothing');
    break;
}

