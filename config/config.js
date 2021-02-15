module.exports = {
  puppeteerSetting: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    userDataDir: "./userData"
  },
  url: {
    twitch: 'https://www.twitch.tv/directory/following/live'
  },
  checkStreamInterval: 1000 * 30,
  checkDiskSpaceAction: {
    isActive: true,
    judgeBy: {
      below: {
        number: 25,
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
    stopRecordDuringReTryInterval: true,
    isRecordEveryOnlineChannel: false
  },
  loginSetting: {
    isManual: false
  },
  // recordVODOption: [
  //   'manual', // 在pending.json裡面寫下Streamlink的下載程式碼，使用者自行用cmd下載
  //   'isAutoStartRecordAfterStreamerOffLine', // 實況結束後，立刻用Streamlink讀取實況紀錄錄影(實際上會等候5分鐘，避免假的實況下線)
  //   'countdownTimer', // 設定實況結束幾分鐘後錄製VOD
  //   'specificTimeZone' // 設定固定時間點，例如凌晨3點開始下載VOD
  // ],
  seedUsersDataSetting: {
    enableRecord: true, //是否啟用錄製
    isRecording: false, //是否正在錄製這個實況者
    enableRecordVOD: {
      isActive: false, // 啟動的話，開始檢查下列情況
      isStopRecordOnlineStream: false, // 啟動的話，禁止錄影正在實況中的實況，啟動的話，正在實況的實況會錄影，實況結束也會錄製VOD
      mode:'isAutoStartRecordAfterStreamerOffLine',
      countdownTimer: 60,
      specificTimeZone: {
        hour:12,
        minute:0,
        second:0
      },   
    },
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