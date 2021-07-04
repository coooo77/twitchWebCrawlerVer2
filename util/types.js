/**
 * @typedef {Object} UsersData
 * @property {User[]}  records
 * @property {string[]}  ids
 */

/**
 * @typedef {Object} User
 * @property {CheckStreamContentType} checkStreamContentType 是否要檢查實況類型相關設定
 * @property {boolean} enableRecord 是否要啟用錄影
 * @property {EnableRecordVOD} enableRecordVOD 啟用錄製VOD相關設定
 * @property {string} fileHandleOption 下載完的檔案處理設定
 * @property {number} id 檔案編號id
 * @property {boolean} isRecording 是否正在錄製該使用者
 * @property {string} twitchID 使用者Twitch ID
 */

/**
 * @typedef {Object} CheckStreamContentType 檢查實況類型相關設定
 * @property {boolean} isActive 是否啟用檢查
 * @property {string[]} targetType 允許下載的實況類型
 */

/**
 * @typedef {Object} EnableRecordVOD 錄製VOD相關設定
 * @property {boolean} isActive 是否要啟用錄影
 * @property {boolean} isStopRecordOnlineStream 是否實況時停止錄影
 * @property {'specificTimeZone' | 'manual' | 'isAutoStartRecordAfterStreamerOffLine' | 'countdownTimer' | 'taskQueue'} mode VOD下載設定
 * @property {number} countdownTimer 實況結束後，倒數幾分鐘開始下載VOD
 * @property {SpecificTimeZone} specificTimeZone 特定時間點下載VOD
 */

/**
 * @typedef {Object} SpecificTimeZone 特定時間點下載VOD
 * @property {number} hour 小時(24制度)
 * @property {number} minute 分鐘
 * @property {number} second 秒
 */

/**
 * @typedef {Object} VodRecord
 * @property {Object<string, VideoUrlAndCategory[]>} pending
 * @property {UserVodRecord[]} ready
 * @property {UserVodRecord[]} onGoing
 * @property {UserVodRecord[]} success
 * @property {UserVodRecord[]} error
 * @property {number[]} queue
 */

/**
 * @typedef {Object} UserVodRecord
 * @property {string} twitchID
 * @property {string} url
 * @property {string} fileName
 * @property {string} cmdCommand
 * @property {number} createdTime
 * @property {string} createdLocalTime
 * @property {string} status
 * @property {number | null} startDownloadTime
 * @property {boolean} isTaskQueue
 * @property {string | null} finishedTime
 * @property {number} reTryInterval
 * @property {number} [retryTimes]
 * @property {string} [formatTime]
 * @property {number} [totalDuration]
 */

/**
 * @typedef {Object} Streaming
 * @property {number} createdTime
 * @property {string} createdLocalTime
 * @property {number} offlineTimesToCheck
 */

/**
 * @typedef {Streaming & UsersData} StreamingUser
 */

/**
 * @typedef {Object} IsStreaming
 * @property {StreamingUser[]} records
 * @property {string[]} ids
 */

/**
 * @typedef OnlineStreamsData
 * @property {string} twitchID
 * @property {string} streamTypes
 */

/**
 * @typedef {Object} ParseTime
 * @property {number} hour 小時
 * @property {number} minute 分鐘
 */

/**
 * @typedef VideoUrlAndCategory
 * @property {string} url
 * @property {string} category
 * @property {boolean} isOnGoingStreaming
 */

module.exports = {}
