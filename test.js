/**
 * 需要針對 user.enableRecordVOD.isStopRecordOnlineStream 做設定 因為isStreaming的ids沒有紀錄該使用者就無法知道有沒有下線
 * 
 * 取得的實況網址url會有null的情況，需要排除會加入pending的情況
 * isChannelOnline 有BUG 有時候會失效
 */

// 修正檢察真正下線的流程，並且修改下載機制

/**
 * @param {}
 * 
 * processor.json = {
 *   queue: {
 * }
 * }
 */

// node test.js


/*
[可以做的項目]
或者是改成是vod的才用網頁檢查是否下線，而實況一律使用bat來下線 似乎有疑慮
下載VOD的結果需要再判斷 (無法?) > 1.  用on檢查訊息，如果有出現非正常的訊息，就移動到error 2. 取得VOD的片長，下載完檢查長度是否在99%以上
使用者實況VOD紀錄 或 歷屆實況紀錄 或 活躍度(實況次數)

[待做項目]
網頁擷取split有時會失敗的原因?
helper重構，先把過程跟純粹函式的部分分開(優化JS引用方式)
做JEST
需要VOD下載失敗的處理機制 > 新增欄位：已經檢查過時間、嘗試重新下載次數、重新下載上限
類型有時候明明是想要的 但取道的好像不是
[SYSTEM] User sig5569 config: isStopRecordOnlineStream is active, stopping to record stream. Set it to false if you want to record it
VOD 在實況時，在video跟follow取道的實況類型有時會不同
重開時是否需要一個機制讓使用者資料確定都下線?選擇性?
重開時是否需要自動讓下載好的檔案進入處理流程?
現在的執行模式似乎負擔很大，有常常斷線的情況，是否要把整個流程改成由Bat執行?
刪除處裡過的檔案時，需要確定是否是已經處理好的檔案存在才刪除
斷線後，需要一個機制自動處理已經下載好的檔案
需要有userFileHandleData找不到的錯誤處理

下面的流程如果找不到檔案需要錯誤處理
      // 把所有檔案移動到processing
      const originalFilePath = origin
      const toPath = getProcessPath(defaultPath.processing)
      moveFiles(fileNames, originalFilePath, toPath)


需要一個手動下載VOD的快速方式

需要一個debug紀錄變數的工具

排列下載需要確定ongoing有沒有排隊下載才繼續下載

每個處理過的檔案都需要拍照

沒有VOD可以下載轉成自動化載實況設定

複數影片片段同時一起處理，而不是各自套用processMaker裡面的設定
*/


/**
 *  1. 下載影片完畢，紀錄資料於queue與pending OK
 *
 * 2. 等候1小時 OK
 *
 * 3. 如果有新的的影片下載中且有使用者處理設定，就把排序中的使用者時間改為null，直到下載結束才回到步驟1 OK
 *
 * 4. 檢查處理時間設定，如果目前處理時間不在範圍內，則調整時間，如果時間衝突，則取最新的一筆來執行
 *
 * 5. 檢查要處裡的檔案數量，如果只有一筆，則按照使用者處理，處理結束後依照結果
 *
 * 6. 如果是多筆，每筆先處理完再合併
 *
 * 7. 合併前要移動紀錄到ongoing
 * 可以做一個整理model的工具 例如做出現在實況中的UsersData來中斷爬蟲錄影 或者是輸出使用者seed名單 (用isStreaming修改即可)
 * 210321 有個BUG是VOD跟實況一起下載，實況可以結束，但是VOD不行，導致VOD卡在那邊 > 檢查是否enable VOD 是的話就讓VOD進入下載循環 OK
 * 210328 建立一個機制 讓isStreaming的狀態實況者去檢查isStreaming有沒有她的資料，如果沒有，檢查是否正在實況，是的話就開始實況，沒有的話修正狀態
 * 影片需要一個機制讓有錯誤的檔案移動到ERROR OK?
 * 需要測試下線功能用計數是否可行 OK
 * 記錄前一個處理時間 如果沒有檔案就回復上一個時間 OK
 * VIDEO影片處裡需要一個拋錯設定 OK?
 * 自定義轉換格式 mp4/ts OK
 */

// ; (async () => {
//   const { helper, webHandler, modelHandler, downloadHandler, fileHandler } = require('./util/helper')

//   await helper.debuglog('test', { test: 1 }, 'test')
// })()

const toggle = false

const obj = {
  t: 1,
  a: toggle ? 123 : undefined
}

console.log(obj)