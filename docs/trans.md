
项目名称 trans-worker
## 背景
meeting会议系统， 每次会议后腾讯音视频系统trtc engine会生成一些列的录制文件。


## 数据大致流程
- 腾讯音视频后台 会议云录制完成，回调 trans-worker api，收到录制完成请求
- trans-worker 接收到录制完成请求后，使用阿里 asr 启动转录
- 转录完成后，将转录结果存储到数据库中
- 所有的都换成，执行回调请求，通知前端转录完成


## 转录文件示例
### trtc录制的文件：

meeting/room_1038631851/D0ceVhZRsonv2fz0Ho3Ugdot+p2RyoIfC6ZVtrFuFf1CadUFnZT7EsBMcwRCmbwbCq+hGpAgG6z7HYgWZgA./20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main.mp4

meeting/room_1038631851/D0ceVhZRsonv2fz0Ho3Ugdot+p2RyoIfC6ZVtrFuFf1CadUFnZT7EsBMcwRCmbwbCq+hGpAgG6z7HYgWZgA./20032332_1038631851__UserId_s_NGM5OTM1OTctNDIxMC00Nzk2LWJkMmQtOTkwZjdiNTJiMWRh__UserId_e_main.mp4

meeting/room_1038631851/D0ceVhZRsonv2fz0Ho3Ugdot+p2RyoIfC6ZVtrFuFf1CadUFnZT7EsBMcwRCmbwbCq+hGpAgG6z7HYgWZgA./20032332_1038631851__UserId_s_NGM5OTM1OTctNDIxMC00Nzk2LWJkMmQtOTkwZjdiNTJiMWRh__UserId_e_main_video.m3u8

meeting/room_1038631851/D0ceVhZRsonv2fz0Ho3Ugdot+p2RyoIfC6ZVtrFuFf1CadUFnZT7EsBMcwRCmbwbCq+hGpAgG6z7HYgWZgA./20032332_1038631851__UserId_s_NGM5OTM1OTctNDIxMC00Nzk2LWJkMmQtOTkwZjdiNTJiMWRh__UserId_e_main_video_20260120113044480.ts

meeting/room_1038631851/D0ceVhZRsonv2fz0Ho3Ugdot+p2RyoIfC6ZVtrFuFf1CadUFnZT7EsBMcwRCmbwbCq+hGpAgG6z7HYgWZgA./20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main_video.m3u8

meeting/room_1038631851/D0ceVhZRsonv2fz0Ho3Ugdot+p2RyoIfC6ZVtrFuFf1CadUFnZT7EsBMcwRCmbwbCq+hGpAgG6z7HYgWZgA./20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main_video_20260120113044145.ts

meeting/room_1038631851/D0ceVhZRsonv2fz0Ho3Ugdot+p2RyoIfC6ZVtrFuFf1CadUFnZT7EsBMcwRCmbwbCq+hGpAgG6z7HYgWZgA./20032332_1038631851__UserId_s_NGM5OTM1OTctNDIxMC00Nzk2LWJkMmQtOTkwZjdiNTJiMWRh__UserId_e_main_audio.m3u8

meeting/room_1038631851/D0ceVhZRsonv2fz0Ho3Ugdot+p2RyoIfC6ZVtrFuFf1CadUFnZT7EsBMcwRCmbwbCq+hGpAgG6z7HYgWZgA./20032332_1038631851__UserId_s_NGM5OTM1OTctNDIxMC00Nzk2LWJkMmQtOTkwZjdiNTJiMWRh__UserId_e_main_audio_20260120113037408.ts

meeting/room_1038631851/D0ceVhZRsonv2fz0Ho3Ugdot+p2RyoIfC6ZVtrFuFf1CadUFnZT7EsBMcwRCmbwbCq+hGpAgG6z7HYgWZgA./20032332_1038631851__UserId_s_NGM5OTM1OTctNDIxMC00Nzk2LWJkMmQtOTkwZjdiNTJiMWRh__UserId_e_main_video_20260120113033054.ts

meeting/room_1038631851/D0ceVhZRsonv2fz0Ho3Ugdot+p2RyoIfC6ZVtrFuFf1CadUFnZT7EsBMcwRCmbwbCq+hGpAgG6z7HYgWZgA./20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main_video_20260120113032574.ts

meeting/room_1038631851/D0ceVhZRsonv2fz0Ho3Ugdot+p2RyoIfC6ZVtrFuFf1CadUFnZT7EsBMcwRCmbwbCq+hGpAgG6z7HYgWZgA./20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main_audio.m3u8

meeting/room_1038631851/D0ceVhZRsonv2fz0Ho3Ugdot+p2RyoIfC6ZVtrFuFf1CadUFnZT7EsBMcwRCmbwbCq+hGpAgG6z7HYgWZgA./20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main_audio_20260120113032488.ts

meeting/room_1038631851/D0ceVhZRsonv2fz0Ho3Ugdot+p2RyoIfC6ZVtrFuFf1CadUFnZT7EsBMcwRCmbwbCq+hGpAgG6z7HYgWZgA./20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main_audio_20260120113022488.ts

meeting/room_1038631851/D0ceVhZRsonv2fz0Ho3Ugdot+p2RyoIfC6ZVtrFuFf1CadUFnZT7EsBMcwRCmbwbCq+hGpAgG6z7HYgWZgA./20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main_video_20260120113022495.ts



### 存储路径格式：
meeting/room_{roomId}/{taskId}/{fileName}

20032332_{roomId}__UserId_s_{base64UserId}__UserId_e_main.mp4

从 COS 观察到的实际文件
单流录制（每个用户独立）：
20032332_{roomId}__UserId_s_{base64UserId}__UserId_e_main.mp4
..._main_video.m3u8 + .ts 分段
..._main_audio.m3u8 + .ts 分段
混流录制（全员合并）：
20032332_{roomId}.mp4
.m3u8 + .ts 分段

roomId： 会议室id
taskId： 任务id
fileName： 转录后的文件名
base64UserId： base64编码的用户id，可以通过这个id在会议系统的数据库中找到真实的用户信息




### m3u8内容
20032332_1038631851__UserId_s_NGM5OTM1OTctNDIxMC00Nzk2LWJkMmQtOTkwZjdiNTJiMWRh__UserId_e_main_audio.m3u8 的内容：
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-ALLOW-CACHE:NO
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-TARGETDURATION:10
#EXT-X-TRTC-VERSION:1debc8
#EXT-X-TRTC-DATE:2025-11-27 11:23:39 +0800
#EXT-X-TRTC-START-REC-TIME:1768908637408
#EXT-X-TRTC-MEDIA-ID:main
#EXT-X-TRTC-USER-ID:4c993597-4210-4796-bd2d-990f7b52b1da
#EXT-X-TRTC-MIX-STREAM:0
#EXT-X-TRTC-STREAM-TYPE:0
#EXT-X-TRTC-AUDIO-METADATA:Channel:1 SampleRate:48000 SampleFormat:1 Codec:86018
#EXT-X-TRTC-FILE-ATTR:1768908637408,169576
#EXTINF:8.788,
20032332_1038631851__UserId_s_NGM5OTM1OTctNDIxMC00Nzk2LWJkMmQtOTkwZjdiNTJiMWRh__UserId_e_main_audio_20260120113037408.ts
#EXT-X-ENDLIST

20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main_audio.m3u8 的内容
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-ALLOW-CACHE:NO
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-TARGETDURATION:10
#EXT-X-TRTC-VERSION:1debc8
#EXT-X-TRTC-DATE:2025-11-27 11:23:39 +0800
#EXT-X-TRTC-START-REC-TIME:1768908622488
#EXT-X-TRTC-MEDIA-ID:main
#EXT-X-TRTC-USER-ID:c756dbf7-4c2a-435a-b19b-0e60eefdc723
#EXT-X-TRTC-MIX-STREAM:0
#EXT-X-TRTC-STREAM-TYPE:0
#EXT-X-TRTC-AUDIO-METADATA:Channel:1 SampleRate:48000 SampleFormat:1 Codec:86018
#EXT-X-TRTC-FILE-ATTR:1768908622488,215448
#EXTINF:10.0053,
20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main_audio_20260120113022488.ts
#EXT-X-TRTC-FILE-ATTR:1768908632488,107912
#EXTINF:5.012,
20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main_audio_20260120113032488.ts
#EXT-X-ENDLIST


20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main_video.m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-ALLOW-CACHE:NO
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-TARGETDURATION:10
#EXT-X-TRTC-VERSION:1debc8
#EXT-X-TRTC-DATE:2025-11-27 11:23:39 +0800
#EXT-X-TRTC-START-REC-TIME:1768908622495
#EXT-X-TRTC-MEDIA-ID:main
#EXT-X-TRTC-USER-ID:c756dbf7-4c2a-435a-b19b-0e60eefdc723
#EXT-X-TRTC-MIX-STREAM:0
#EXT-X-TRTC-STREAM-TYPE:1
#EXT-X-TRTC-VIDEO-METADATA:WIDTH:640 HEIGHT:480 Codec:27
#EXT-X-TRTC-FILE-ATTR:1768908622495,684508
#EXTINF:10.0785,
20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main_video_20260120113022495.ts
#EXT-X-TRTC-FILE-ATTR:1768908632574,826824
#EXTINF:11.5708,
20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main_video_20260120113032574.ts
#EXT-X-TRTC-FILE-ATTR:1768908644145,304748
#EXTINF:4.37792,
20032332_1038631851__UserId_s_Yzc1NmRiZjctNGMyYS00MzVhLWIxOWItMGU2MGVlZmRjNzIz__UserId_e_main_video_20260120113044145.ts
#EXT-X-ENDLIST

20032332_1038631851__UserId_s_NGM5OTM1OTctNDIxMC00Nzk2LWJkMmQtOTkwZjdiNTJiMWRh__UserId_e_main_video.m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-ALLOW-CACHE:NO
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-TARGETDURATION:10
#EXT-X-TRTC-VERSION:1debc8
#EXT-X-TRTC-DATE:2025-11-27 11:23:39 +0800
#EXT-X-TRTC-START-REC-TIME:1768908633054
#EXT-X-TRTC-MEDIA-ID:main
#EXT-X-TRTC-USER-ID:4c993597-4210-4796-bd2d-990f7b52b1da
#EXT-X-TRTC-MIX-STREAM:0
#EXT-X-TRTC-STREAM-TYPE:1
#EXT-X-TRTC-VIDEO-METADATA:WIDTH:640 HEIGHT:480 Codec:27
#EXT-X-TRTC-FILE-ATTR:1768908633054,774936
#EXTINF:11.4257,
20032332_1038631851__UserId_s_NGM5OTM1OTctNDIxMC00Nzk2LWJkMmQtOTkwZjdiNTJiMWRh__UserId_e_main_video_20260120113033054.ts
#EXT-X-TRTC-FILE-ATTR:1768908644480,302116
#EXTINF:3.95243,
20032332_1038631851__UserId_s_NGM5OTM1OTctNDIxMC00Nzk2LWJkMmQtOTkwZjdiNTJiMWRh__UserId_e_main_video_20260120113044480.ts
#EXT-X-ENDLIST


## 需求
根据以上信息， 我们需要实现一个音视频转录成文字的功能， 

### 技术栈
转录模型使用阿里云的asr, paraformer-v2 
参考文档: https://help.aliyun.com/zh/model-studio/paraformer-recorded-speech-recognition-restful-api?spm=a2c4g.11186623.0.i4

### 转录需求
需要说话人分离
不需要实时字幕.
转录后处理,  需要按说话人分段
录音文件存储在 腾讯云的cos上.
说话人数量不固定,
转录后处理, 在前端能看到转录的结果.整体转录结果,及每个人的转录结果(时间,说话人, 内容)
转录后的数据存储在PostgreSQL数据库中
COS 访问方式 - 公共读取
说话人需要关联会议系统中的真实人名, 可以用会议系统的数据库中取
cos的路径在可以 .env文件中找到配置

### 技术要求
1. 在前端，开发一个转录列表的页面，放在后台的页面上。每个会议，有一个转录，可以下载文字转录结果，并且可以下载原始视频或者音频。 


### 技术方案
会议系统，结束会议，需要触发转录任务
后台有一个worker，会定期检查数据库中的转录任务，如果有任务，就去转录，转录完成后，将结果存储到数据库中，并更新数据库中的任务状态。

重点！！！： 转录结果文件中，必须保证真实的时序，说话人需要关联会议系统中的真实人名
重点！！！： 转录结果文件中，必须保证真实的时序，说话人需要关联会议系统中的真实人名
重点！！！： 转录结果文件中，必须保证真实的时序，说话人需要关联会议系统中的真实人名


## 资源
### 腾讯云 COS 配置
COS_SECRET_ID=IKIDdn8MK9mESSGqEPN8fz62oQp370jKm5FG
COS_SECRET_KEY=udBcvAIH6lSI2ZtGVu9D6lpr2JUUeifS
COS_BUCKET=xiaofan-1395107881
COS_REGION=ap-hongkong

### 阿里云 DashScope API
DASHSCOPE_API_KEY=sk-4d3662a5490f4bceaf404fe8befc2d82

## trtc 腾讯音视频 控制台，云录制完成后回调结果

 录制记录已更新: D0e6x89Rsp-esui8b4iOs3gqSzfJsasfAt5ItrFuFf1CadUFnZT7EsBMcwRCGY6m5ECaEoW4PboiqfSZBAA.
✅ 录制已停止: D0e6x89Rsp-esui8b4iOs3gqSzfJsasfAt5ItrFuFf1CadUFnZT7EsBMcwRCGY6m5ECaEoW4PboiqfSZBAA.
🛑 4c993597-4210-4796-bd2d-990f7b52b1da 结束了会议 3369810761
📝 已为会议 3369810761 添加转录任务

📞 [POST /api/recording/callback] 收到腾讯云录制回调
   请求体: {
  "EventGroupId": 3,
  "EventType": 305,
  "CallbackTs": 1768960945429,
  "EventInfo": {
    "RoomId": "3369810761",
    "EventTs": 1768960945,
    "EventMsTs": 1768960945384,
    "UserId": "recorder_3369810761_1768960834912",
    "TaskId": "D0e6x89Rsp-esui8b4iOs3gqSzfJsasfAt5ItrFuFf1CadUFnZT7EsBMcwRCGY6m5ECaEoW4PboiqfSZBAA.",
    "Payload": {
      "Status": 0
    }
  }
}
   📋 事件类型: 305
   🏠 房间: undefined
   👤 用户: undefined
   📝 任务: undefined

📞 [POST /api/recording/callback] 收到腾讯云录制回调
   请求体: {
  "EventGroupId": 3,
  "EventType": 302,
  "CallbackTs": 1768960945393,
  "EventInfo": {
    "RoomId": "3369810761",
    "EventTs": "1768960945",
    "EventMsTs": 1768960945351,
    "UserId": "recorder_3369810761_1768960834912",
    "TaskId": "D0e6x89Rsp-esui8b4iOs3gqSzfJsasfAt5ItrFuFf1CadUFnZT7EsBMcwRCGY6m5ECaEoW4PboiqfSZBAA.",
    "Payload": {
      "LeaveCode": 0
    }
  }
}
   📋 事件类型: 302
   🏠 房间: undefined
   👤 用户: undefined
   📝 任务: undefined

📞 [POST /api/recording/callback] 收到腾讯云录制回调
   请求体: {
  "EventGroupId": 3,
  "EventType": 310,
  "CallbackTs": 1768960948018,
  "EventInfo": {
    "RoomId": "3369810761",
    "EventTs": 1768960947,
    "EventMsTs": 1768960947971,
    "UserId": "recorder_3369810761_1768960834912",
    "TaskId": "D0e6x89Rsp-esui8b4iOs3gqSzfJsasfAt5ItrFuFf1CadUFnZT7EsBMcwRCGY6m5ECaEoW4PboiqfSZBAA.",
    "Payload": {
      "Status": 0,
      "FileList": [
        "20032332_3369810761__UserId_s_NGM5OTM1OTctNDIxMC00Nzk2LWJkMmQtOTkwZjdiNTJiMWRh__UserId_e_main.mp4"
      ],
      "FileMessage": [
        {
          "FileName": "20032332_3369810761__UserId_s_NGM5OTM1OTctNDIxMC00Nzk2LWJkMmQtOTkwZjdiNTJiMWRh__UserId_e_main.mp4",
          "UserId": "4c993597-4210-4796-bd2d-990f7b52b1da",
          "TrackType": "audio_video",
          "MediaId": "main",
          "StartTimeStamp": 1768960840831,
          "EndTimeStamp": 1768960944851
        }
      ]
    }
  }
}
   📋 事件类型: 310
   🏠 房间: undefined
   👤 用户: undefined
   📝 任务: undefined