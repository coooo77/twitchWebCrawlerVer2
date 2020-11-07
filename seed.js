(async () => {
  const { seedUsersDataSetting } = require('./config/config')
  const { seed } = require('./config/announce')
  const helper = require('./util/helper')

  helper.announcer(seed.initiation)

  const [seedData, usersData] = await Promise.all([
    helper.getJSObjData('./model/seed/seed.json'),
    helper.getJSObjData('./model/usersData.json')
  ])

  const records = seedData.map((user, index) => ({
    id: index,
    ...user,
    ...seedUsersDataSetting
  }))
  const ids = seedData.map(user => user.twitchID)

  usersData.records = records
  usersData.ids = ids

  await helper.saveJSObjData(usersData)
  
  helper.announcer(seed.numOfUsers(seedData.length))
  helper.announcer(seed.initiationIsFinished)
})()