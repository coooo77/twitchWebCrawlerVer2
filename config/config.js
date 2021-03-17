const config = {
  puppeteerSetting: {
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    userDataDir: "./userData"
  },
  url: {
    twitch: 'https://www.twitch.tv/directory/following/live',
    test: 'https://www.twitch.tv/yueko/videos?filter=archives&sort=time',
    baseUrl: 'https://www.twitch.tv/',
    videos: '/videos?filter=archives&sort=time'
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
    maxTryTimes: 5,
    prefix: '',
    stopRecordDuringReTryInterval: true,
    isRecordEveryOnlineChannel: true,
    taskQueueConfig: {
      mode: 'countdownTimer',
      countdownTimer: 1,
      specificTimeZone: {
        hour: 3,
        minute: 0,
        second: 0
      },
    }
  },
  processSetting: {
    fileLocation: {
      /**
       * 沒有設定的話，會在爬蟲的資料夾建立資料夾
       */
      origin: 'D:\\JD', // 必填
      processing: 'D:\\JD\\processing',
      processed: 'D:\\JD\\processed',
      defaultPath: {
        processRoot: 'process',
        processing: 'processing',
        processed: 'processed'
      }
    },
    suffix: {
      mute: 'mute',
      compress: 'convert',
      combined: 'combined'
    },
    ffmpegPath: 'D:\\ffmpeg\\bin\\ffmpeg.exe',
    probePath: 'D:\\ffmpeg\\bin\\ffprobe.exe',
    minutesToDelay: 30 * 60 * 1000
  },
  loginSetting: {
    isManual: false
  },

  /**
   * recordVODOption(VOD下載選項)
   * 
   * @param {Null} manual vodRecord.json裡面寫下Streamlink的下載程式碼，使用者自行用cmd下載
   * @param {Null} isAutoStartRecordAfterStreamerOffLine 實況結束後，立刻用Streamlink讀取實況紀錄錄影
   * @param {Number} countdownTimer 設定實況結束幾分鐘後錄製VOD
   * @param {Object} specificTimeZone 設定固定時間點，例如凌晨3點開始下載VOD
   * @param {Object} taskQueue 排隊式下載VOD，一個VOD下載完才會去下載另一個標記有taskQueue的VOD，下載設定參照taskQueue
   */

  seedUsersDataSetting: {
    enableRecord: true, //是否啟用錄製
    isRecording: false, //是否正在錄製這個實況者
    enableRecordVOD: {
      isActive: false, // 啟動的話，開始檢查下列情況
      isStopRecordOnlineStream: false, // 啟動的話，禁止錄影正在實況中的實況，啟動的話，正在實況的實況會錄影，實況結束也會錄製VOD
      mode: 'specificTimeZone',
      countdownTimer: 60,
      specificTimeZone: {
        hour: 3,
        minute: 0,
        second: 0
      },
    },
    checkStreamContentType: {
      isActive: false,
      targetType: ['Art', 'Just%20Chatting']
    },
    fileHandleOption: 'keep mute compress combine from:0000 to:2359 screenshot:70_80_90'
  }
}

module.exports = config
// Mega Byte(MB)
// Giga Byte(GB)
// Tera Byte(TB)
// disableRecordAgainIfItIsRecording : 30 * 120 sec