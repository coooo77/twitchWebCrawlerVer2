/*
ToDo:
1. 檢查是否重複ID
2. 可以讓使用者針對ID做設計
3. 整理ID功能
4. 對比records跟ids是否相符?
*/

(async () => {
  const helper = require('./util/helper')

  const usersData = await helper.getJSObjData('./model/usersData.json')

  const { ids, records } = usersData
  const recordsList = records.map(user => user.twitchID)

  // 檢查records跟ids是否有互相缺失的情形
  helper.arrayComparer(recordsList, ids, 'recordsList', 'ids')
  helper.arrayComparer(ids, recordsList, 'ids', 'recordsList')

  let newRecords = records.sort((a, b) => a.twitchID > b.twitchID ? 1 : -1)
  newRecords = newRecords.map((user, index) => ({
    ...user,
    id: index
  }))
  const newIds = newRecords.map(user => user.twitchID)

  usersData.records = newRecords
  usersData.ids = newIds

  await helper.saveJSObjData(usersData)
  console.log('Done \u2665')
})()