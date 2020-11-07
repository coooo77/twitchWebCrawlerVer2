module.exports = {
  app: {
    startToLogin: 'User needs to login, start to login...',
    startToFetchStream: 'Start to fetch stream ...',
    manualLogin: 'Manual function is active, enter your account and password please',
    askAccount: 'Enter your account : ',
    askPassword: 'Enter your password : ',
    askSMS: 'Enter SMS number : ',
    askSMSAgain: 'SMS input action fail, enter your SMS again : ',
    noDataInfo: 'Account or password missed, please fill it!',
    recordAction: {
      checkFreeDiskSpace: {
        info: 'Disk space monitor is active, check desk space now ...',
        freeSpace: (number, limit) => `Free space is ${number} left (limit: ${limit})`,
        stopRecord: 'Space is not enough, stop record progress ...',
        StartRecord: 'Space is enough, start record progress ...'
      }
    }
  }
}