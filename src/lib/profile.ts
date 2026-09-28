import type { DeviceProfile } from "@jellyfin/sdk/lib/generated-client/models";

function canMse(type: string) {
  try {
    return typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(type);
  } catch {
    return false;
  }
}

function canVideo(type: string) {
  const v = document.createElement("video");
  return v.canPlayType(type).replace(/no/, "") !== "" || canMse(type);
}

export interface Caps {
  hevc: boolean;
  av1: boolean;
  vp9: boolean;
  hlsNative: boolean;
}

export function detectCaps(): Caps {
  const v = document.createElement("video");
  return {
    hevc: canVideo('video/mp4; codecs="hvc1.1.6.L120.90"') || canVideo('video/mp4; codecs="hev1.1.6.L120.90"'),
    av1: canVideo('video/mp4; codecs="av01.0.08M.08"'),
    vp9: canVideo('video/webm; codecs="vp9"'),
    hlsNative: v.canPlayType("application/vnd.apple.mpegurl") !== "",
  };
}

export function buildProfile(maxBitrate: number, burnSubtitles = false): DeviceProfile {
  const c = detectCaps();
  const mp4Video = ["h264", c.hevc && "hevc", c.av1 && "av1"].filter(Boolean).join(",");
  const audio = "aac,mp3,opus,flac,alac,ac3,eac3";
  const transcodeVideo = ["h264", c.hevc && "hevc"].filter(Boolean).join(",");
  const textMethod = burnSubtitles ? "Encode" : "External";
  return {
    Name: "bbtt",
    MaxStreamingBitrate: maxBitrate,
    MaxStaticBitrate: 100_000_000,
    MusicStreamingTranscodingBitrate: 384_000,
    DirectPlayProfiles: [
      { Container: "mp4,m4v,mov", Type: "Video", VideoCodec: mp4Video, AudioCodec: audio },
      ...(c.vp9 || c.av1
        ? [{ Container: "webm", Type: "Video" as const, VideoCodec: ["vp8", c.vp9 && "vp9", c.av1 && "av1"].filter(Boolean).join(","), AudioCodec: "vorbis,opus" }]
        : []),
      { Container: "mp3", Type: "Audio" },
      { Container: "aac,m4a,m4b", Type: "Audio", AudioCodec: "aac,alac" },
      { Container: "flac", Type: "Audio" },
      { Container: "webm,ogg,opus", Type: "Audio", AudioCodec: "opus,vorbis" },
      { Container: "wav", Type: "Audio" },
    ],
    TranscodingProfiles: [
      {
        Container: c.hevc ? "mp4" : "ts",
        Type: "Video",
        VideoCodec: transcodeVideo,
        AudioCodec: "aac,mp3,opus,flac,ac3,eac3",
        Context: "Streaming",
        Protocol: "hls",
        MaxAudioChannels: "6",
        MinSegments: 1,
        BreakOnNonKeyFrames: true,
      },
      { Container: "mp3", Type: "Audio", AudioCodec: "mp3", Context: "Streaming", Protocol: "http", MaxAudioChannels: "2" },
    ],
    ContainerProfiles: [],
    CodecProfiles: [
      {
        Type: "Video",
        Codec: "h264",
        Conditions: [
          { Condition: "NotEquals", Property: "IsAnamorphic", Value: "true", IsRequired: false },
          { Condition: "LessThanEqual", Property: "VideoLevel", Value: "52", IsRequired: false },
          { Condition: "LessThanEqual", Property: "VideoBitDepth", Value: "8", IsRequired: false },
        ],
      },
    ],
    SubtitleProfiles: [
      { Format: "vtt", Method: textMethod },
      { Format: "srt", Method: textMethod },
      { Format: "subrip", Method: textMethod },
      { Format: "ass", Method: textMethod },
      { Format: "ssa", Method: textMethod },
      { Format: "pgssub", Method: "Encode" },
      { Format: "dvdsub", Method: "Encode" },
      { Format: "dvbsub", Method: "Encode" },
    ],
  };
}
