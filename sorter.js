/*
ToDo:
1. 檢查是否重複ID
2. 可以讓使用者針對ID做設計
3. 整理ID功能
4. 對比records跟ids是否相符?
*/

(async () => {
  const { seedUsersDataSetting } = require('./config/config')
  const helper = require('./util/helper')

  const usersData = await helper.getJSObjData('./model/usersData.json')

  const { ids, records } = usersData
  const recordsList = records.map(user => user.twitchID)

  // 檢查records跟ids是否有互相缺失的情形
  helper.arrayComparer(recordsList, ids, 'recordsList', 'ids')
  helper.arrayComparer(ids, recordsList, 'ids', 'recordsList')

  const newIds = Array.from(new Set(recordsList.concat(ids))).sort((a, b) => a > b ? 1 : -1)

  let newRecords = newIds.map((id, index) => {
    const user = records.find(user => user.twitchID === id)
    if (!user) {
      return {
        ...seedUsersDataSetting,
        twitchID: id,
        id: index
      }
    } else {
      return {
        ...user,
        id: index
      }
    }
  })

  usersData.records = newRecords
  usersData.ids = newIds

  await helper.saveJSObjData(usersData)
  console.log('Done \u2665')
})()