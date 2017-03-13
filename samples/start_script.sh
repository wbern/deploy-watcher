#!/bin/sh

export DW_CWD=$HOME
export DW_SCRIPT_MODE='deploy'
export DW_APP_LOGFILE='server.log'
export DW_DB_USER="dbuser"
export DW_DB_OID="mydb"
export DW_DB_HOST="127.0.0.1"
export DW_SCRIPT_LOGFILE="deploy-watcher.log"
export DW_PROD_FILENAME="app.production.jar"
export DW_DEPLOY_FILENAME="app.production.jar.to.deploy"
export DW_PKILL_TEXT="java"

node ../index.js