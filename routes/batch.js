import express from 'express';
import { processChannel, processPlaylist } from '../services/batchProcessService.js';
import { extractChannelId, extractPlaylistId } from '../utils/youtubeDataAPI.js';

const router = express.Router();

/**
 * POST /api/batch/channel
 * 채널의 모든 동영상 처리
 */
router.post('/channel', async (req, res) => {
  try {
    const { 
      channelUrl, 
      keyword = null, 
      maxVideos = null,
      startTime = null,
      endTime = null,
      autoIndex = false,
      delayBetweenVideos = 5000
    } = req.body;

    if (!channelUrl) {
      return res.status(400).json({ error: 'channelUrl is required' });
    }

    // 채널 URL 검증
    try {
      extractChannelId(channelUrl);
    } catch (error) {
      return res.status(400).json({ error: `Invalid channel URL: ${error.message}` });
    }

    // 비동기로 처리 시작 (백그라운드 작업)
    const processPromise = processChannel(channelUrl, {
      keyword,
      maxVideos,
      startTime,
      endTime,
      autoIndex,
      delayBetweenVideos,
      onProgress: (progress) => {
        // 진행 상황을 로그로 출력 (실시간 업데이트는 WebSocket이나 Server-Sent Events 필요)
        console.log(`진행 상황: ${progress.current}/${progress.total} (성공: ${progress.processed}, 실패: ${progress.failed})`);
      }
    });

    // 즉시 응답 반환 (비동기 처리)
    res.json({
      success: true,
      message: '채널 배치 처리가 시작되었습니다.',
      channelUrl,
      options: {
        keyword,
        maxVideos,
        startTime,
        endTime,
        autoIndex
      }
    });

    // 백그라운드에서 처리
    processPromise
      .then(result => {
        console.log('채널 배치 처리 완료:', result);
      })
      .catch(error => {
        console.error('채널 배치 처리 오류:', error);
      });

  } catch (error) {
    console.error('Batch channel error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * POST /api/batch/playlist
 * 재생목록의 모든 동영상 처리
 */
router.post('/playlist', async (req, res) => {
  try {
    const { 
      playlistUrl, 
      keyword = null, 
      maxVideos = null,
      startTime = null,
      endTime = null,
      autoIndex = false,
      delayBetweenVideos = 5000
    } = req.body;

    if (!playlistUrl) {
      return res.status(400).json({ error: 'playlistUrl is required' });
    }

    // 재생목록 URL 검증
    try {
      extractPlaylistId(playlistUrl);
    } catch (error) {
      return res.status(400).json({ error: `Invalid playlist URL: ${error.message}` });
    }

    // 비동기로 처리 시작 (백그라운드 작업)
    const processPromise = processPlaylist(playlistUrl, {
      keyword,
      maxVideos,
      startTime,
      endTime,
      autoIndex,
      delayBetweenVideos,
      onProgress: (progress) => {
        console.log(`진행 상황: ${progress.current}/${progress.total} (성공: ${progress.processed}, 실패: ${progress.failed})`);
      }
    });

    // 즉시 응답 반환 (비동기 처리)
    res.json({
      success: true,
      message: '재생목록 배치 처리가 시작되었습니다.',
      playlistUrl,
      options: {
        keyword,
        maxVideos,
        startTime,
        endTime,
        autoIndex
      }
    });

    // 백그라운드에서 처리
    processPromise
      .then(result => {
        console.log('재생목록 배치 처리 완료:', result);
      })
      .catch(error => {
        console.error('재생목록 배치 처리 오류:', error);
      });

  } catch (error) {
    console.error('Batch playlist error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * POST /api/batch/channel/sync
 * 채널의 모든 동영상 처리 (동기식 - 결과 대기)
 */
router.post('/channel/sync', async (req, res) => {
  try {
    const { 
      channelUrl, 
      keyword = null, 
      maxVideos = null,
      startTime = null,
      endTime = null,
      autoIndex = false,
      delayBetweenVideos = 5000
    } = req.body;

    if (!channelUrl) {
      return res.status(400).json({ error: 'channelUrl is required' });
    }

    // 채널 URL 검증
    try {
      extractChannelId(channelUrl);
    } catch (error) {
      return res.status(400).json({ error: `Invalid channel URL: ${error.message}` });
    }

    // 동기식으로 처리 (결과 대기)
    const result = await processChannel(channelUrl, {
      keyword,
      maxVideos,
      startTime,
      endTime,
      autoIndex,
      delayBetweenVideos
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Batch channel sync error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * POST /api/batch/playlist/sync
 * 재생목록의 모든 동영상 처리 (동기식 - 결과 대기)
 */
router.post('/playlist/sync', async (req, res) => {
  try {
    const { 
      playlistUrl, 
      keyword = null, 
      maxVideos = null,
      startTime = null,
      endTime = null,
      autoIndex = false,
      delayBetweenVideos = 5000
    } = req.body;

    if (!playlistUrl) {
      return res.status(400).json({ error: 'playlistUrl is required' });
    }

    // 재생목록 URL 검증
    try {
      extractPlaylistId(playlistUrl);
    } catch (error) {
      return res.status(400).json({ error: `Invalid playlist URL: ${error.message}` });
    }

    // 동기식으로 처리 (결과 대기)
    const result = await processPlaylist(playlistUrl, {
      keyword,
      maxVideos,
      startTime,
      endTime,
      autoIndex,
      delayBetweenVideos
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Batch playlist sync error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

export default router;
