// AUTO-GENERATED on 2026-08-11T15:24:30.602456

export interface Preset {
  id: string;
  driverId: string;
  racingNumber: number | null;
  grandPrix: string;
  sessionDate: string;
  messageTimestamp: string;
  audioUrl: string;
  durationSeconds: number;
  correlationMethod: "exact" | "fallback_early" | "fallback_mid" | "fallback_late" | "error";
  expectedLapNumber: number | null;
  expectedLapDuration: number | null;
  emotionRawLabel: string;
  emotionScore: number;
}

export const PRESETS: Preset[] = [
  {
    "id": "2023_Bahrain_Grand_Prix_CHALEC01_16_20230305_155040",
    "driverId": "CHALEC01",
    "racingNumber": 16,
    "grandPrix": "2023 Bahrain Grand Prix",
    "sessionDate": "2023-03-05",
    "messageTimestamp": "2023-03-05T15:50:57.699Z",
    "audioUrl": "/presets/2023_Bahrain_Grand_Prix_CHALEC01_16_20230305_155040.wav",
    "durationSeconds": 0.5,
    "correlationMethod": "exact",
    "expectedLapNumber": 29,
    "expectedLapDuration": 98.447,
    "emotionRawLabel": "neutral",
    "emotionScore": 0.138
  },
  {
    "id": "2023_Bahrain_Grand_Prix_FERALO01_14_20230305_152529",
    "driverId": "FERALO01",
    "racingNumber": 14,
    "grandPrix": "2023 Bahrain Grand Prix",
    "sessionDate": "2023-03-05",
    "messageTimestamp": "2023-03-05T15:25:47.523Z",
    "audioUrl": "/presets/2023_Bahrain_Grand_Prix_FERALO01_14_20230305_152529.wav",
    "durationSeconds": 7.2,
    "correlationMethod": "exact",
    "expectedLapNumber": 14,
    "expectedLapDuration": 102.212,
    "emotionRawLabel": "neutral",
    "emotionScore": 0.138
  },
  {
    "id": "2023_Bahrain_Grand_Prix_GEORUS01_63_20230305_155430",
    "driverId": "GEORUS01",
    "racingNumber": 63,
    "grandPrix": "2023 Bahrain Grand Prix",
    "sessionDate": "2023-03-05",
    "messageTimestamp": "2023-03-05T15:54:53.351Z",
    "audioUrl": "/presets/2023_Bahrain_Grand_Prix_GEORUS01_63_20230305_155430.wav",
    "durationSeconds": 3.7,
    "correlationMethod": "exact",
    "expectedLapNumber": 31,
    "expectedLapDuration": 101.035,
    "emotionRawLabel": "neutral",
    "emotionScore": 0.138
  },
  {
    "id": "2023_Bahrain_Grand_Prix_LANNOR01_4_20230305_151548",
    "driverId": "LANNOR01",
    "racingNumber": 4,
    "grandPrix": "2023 Bahrain Grand Prix",
    "sessionDate": "2023-03-05",
    "messageTimestamp": "2023-03-05T15:16:18.377Z",
    "audioUrl": "/presets/2023_Bahrain_Grand_Prix_LANNOR01_4_20230305_151548.wav",
    "durationSeconds": 4.8,
    "correlationMethod": "exact",
    "expectedLapNumber": 8,
    "expectedLapDuration": 100.857,
    "emotionRawLabel": "neutral",
    "emotionScore": 0.138
  },
  {
    "id": "2023_Bahrain_Grand_Prix_SERPER01_11_20230305_161725",
    "driverId": "SERPER01",
    "racingNumber": 11,
    "grandPrix": "2023 Bahrain Grand Prix",
    "sessionDate": "2023-03-05",
    "messageTimestamp": "2023-03-05T16:17:40.029Z",
    "audioUrl": "/presets/2023_Bahrain_Grand_Prix_SERPER01_11_20230305_161725.wav",
    "durationSeconds": 4.2,
    "correlationMethod": "exact",
    "expectedLapNumber": 45,
    "expectedLapDuration": 96.928,
    "emotionRawLabel": "neutral",
    "emotionScore": 0.138
  },
  {
    "id": "2023_Azerbaijan_Grand_Prix_CARSAI01_55_20230430_121241",
    "driverId": "CARSAI01",
    "racingNumber": 55,
    "grandPrix": "2023 Azerbaijan Grand Prix",
    "sessionDate": "2023-04-30",
    "messageTimestamp": "2023-04-30T11:13:14.42Z",
    "audioUrl": "/presets/2023_Azerbaijan_Grand_Prix_CARSAI01_55_20230430_121241.wav",
    "durationSeconds": 4.2,
    "correlationMethod": "exact",
    "expectedLapNumber": 17,
    "expectedLapDuration": 105.418,
    "emotionRawLabel": "neutral",
    "emotionScore": 0.138
  },
  {
    "id": "2023_Azerbaijan_Grand_Prix_LEWHAM01_44_20230430_122357",
    "driverId": "LEWHAM01",
    "racingNumber": 44,
    "grandPrix": "2023 Azerbaijan Grand Prix",
    "sessionDate": "2023-04-30",
    "messageTimestamp": "2023-04-30T12:24:06Z",
    "audioUrl": "/presets/2023_Azerbaijan_Grand_Prix_LEWHAM01_44_20230430_122357.wav",
    "durationSeconds": 7.6,
    "correlationMethod": "exact",
    "expectedLapNumber": 17,
    "expectedLapDuration": 105.854,
    "emotionRawLabel": "neutral",
    "emotionScore": 0.138
  },
  {
    "id": "2023_Azerbaijan_Grand_Prix_MAXVER01_1_20230430_111543",
    "driverId": "MAXVER01",
    "racingNumber": 1,
    "grandPrix": "2023 Azerbaijan Grand Prix",
    "sessionDate": "2023-04-30",
    "messageTimestamp": "2023-04-30T10:16:01.248Z",
    "audioUrl": "/presets/2023_Azerbaijan_Grand_Prix_MAXVER01_1_20230430_111543.wav",
    "durationSeconds": 15.2,
    "correlationMethod": "exact",
    "expectedLapNumber": 17,
    "expectedLapDuration": 105.5,
    "emotionRawLabel": "neutral",
    "emotionScore": 0.138
  }
];
