module.exports = {
  puppeteerSetting: {
    executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    userDataDir: "./userData"
  },
  url: {
    twitch: 'https://www.twitch.tv/directory/following/live'
  },
  stopRecordAction: {
    isActive: false,
    activeBy: {
      percentage: 'percentage',
      MB: Math.pow(2, 20),
      GB: Math.pow(2, 30),
      TB: Math.pow(2, 40),
    }
  },
  recordSetting: {
    reTryInterval: 30,
    maxTryTimes: 120,
    prefix: '@',
    disableRecordAgainIfItIsRecording: true
  },
  loginSetting: {
    isManual: false
  }
}

// Mega Byte(MB)
// Giga Byte(GB)
// Tera Byte(TB)
// disableRecordAgainIfItIsRecording : 30 * 120 sec