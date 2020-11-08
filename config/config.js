module.exports = {
  puppeteerSetting: {
    executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    userDataDir: "./userData"
  },
  url: {
    twitch: 'https://www.twitch.tv/directory/following/live'
  },
  checkDiskSpaceAction: {
    isActive: true,
    judgeBy: {
      below: {
        number: 100,
        unit: 'GB', // choose 'percentage','MB','GB' or 'TB'
        digit: 2
      },
      type: {
        percentage: 'percentage',
        MB: Math.pow(2, 20),
        GB: Math.pow(2, 30),
        TB: Math.pow(2, 40),
      }
    }
  },
  recordSetting: {
    locationOfDiskWhereRecordSaved: 'D:\\',
    locationOfFolderWhereRecordSaved: 'D:\\JD',
    reTryInterval: 30,
    maxTryTimes: 60,
    prefix: '',
    stopRecordDuringReTryInterval: true
  },
  loginSetting: {
    isManual: false
  },
  seedUsersDataSetting: {
    isRecording: false,
    checkStreamContentType: {
      isActive: true,
      targetType: ['Art', 'Just%20Chatting']
    }
  }
}

// Mega Byte(MB)
// Giga Byte(GB)
// Tera Byte(TB)
// disableRecordAgainIfItIsRecording : 30 * 120 sec