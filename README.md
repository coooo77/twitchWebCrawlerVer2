# pixivRecord-Ver2

## 安裝與執行步驟 (installation and execution)：

1. 啟動終端，下載Github頁面上內容

```console
git clone https://github.com/coooo77/twitchWebCrawlerVer2
```

2. 以指令cd移動至twitchWebCrawlerVer2資料夾底下

```console
cd twitchWebCrawlerVer2
```

3. 根據環境建置與需求安裝軟體與套件

```console
npm install 

或 

npm i
```

4. 初始化設定
```console
npm run init
```

5. 根據.env.example設定輸入帳號密碼，或者選擇手動輸入功能

6. 在seedData.json輸入要追隨的使用者帳號ID，或者選擇自動更新使用者資料功能
```console
// ./model/seed/seedData.json
[
  {
    "twitchID": "Account_01"
  },
  {
    "twitchID": "Account_02"
  },

  ...

  {
    "twitchID": "Account_NN"
  }
]
```

執行指令，將帳號ID輸入使用者資料
```console
npm run seed
```

7. 啟動專案
```console
npm run dev
```

## 功能描述 (features)：
* 支援背景執行
(puppeteerSetting/headless)
* 使用者可以指定不追蹤特定實況主
(recordSetting/isRecordEveryOnlineChannel)
* 使用者可以自動新增實況主資料
(recordSetting/isRecordEveryOnlineChannel)
* 使用者可以設定錄影檔案名稱
(recordSetting/prefix)
* 使用者可以設定錄影嘗試次數與每次嘗試等待時間
(recordSetting/reTryInterval、maxTryTimes)
* 使用者可以設定監控時間間隔
(checkStreamInterval)
* 使用者可以設定是否要依照貯存空間來進行錄影
(checkDiskSpaceAction)
* 使用者可以針對實況者實況內容決定是否錄影
(seedUsersDataSetting/checkStreamContentType)