export interface SessionRecord {
  id: string;
  timestamp: string;
  channel: string;
  value: string;
  hmacDigest: string;
  status: 'Valid' | 'Warning' | 'Invalid';
}

export interface RecordingSession {
  id: string;
  name: string;
  device: string;
  dataSource: string;
  recordCount: number;
  duration: string;
  startedAt: string;
  status: 'Valid' | 'Warning' | 'Invalid';
  description?: string;
  sampleRecords: SessionRecord[];
}

export const INITIAL_SESSIONS: RecordingSession[] = [
  {
    id: 'SES-2026-0041',
    name: 'Temperature Test',
    device: 'ESP32-LAB-01',
    dataSource: 'ESP32 Sensor',
    recordCount: 20,
    duration: '1h 12m',
    startedAt: '2026-10-12 17:45',
    status: 'Valid',
    description: 'Chamber Alpha thermal equilibrium stress test over 72 minutes with calibrated resistance thermometer.',
    sampleRecords: [
      { id: 'REC-001', timestamp: '17:45:02', channel: 'TEMP_CH0', value: '24.2 °C', hmacDigest: '7a29f0...e4c1', status: 'Valid' },
      { id: 'REC-002', timestamp: '17:48:40', channel: 'TEMP_CH0', value: '24.5 °C', hmacDigest: '8b11c2...99ad', status: 'Valid' },
      { id: 'REC-003', timestamp: '17:52:15', channel: 'TEMP_CH0', value: '24.6 °C', hmacDigest: '4c88a9...31fe', status: 'Valid' },
      { id: 'REC-004', timestamp: '17:56:00', channel: 'TEMP_CH0', value: '24.8 °C', hmacDigest: '90ea12...04bc', status: 'Valid' },
      { id: 'REC-005', timestamp: '18:00:22', channel: 'TEMP_CH0', value: '24.6 °C', hmacDigest: '66fe42...19ac', status: 'Valid' },
    ],
  },
  {
    id: 'SES-2026-0042',
    name: 'Sensor Calibration',
    device: 'ESP32-LAB-02',
    dataSource: 'Sensor',
    recordCount: 16,
    duration: '52m',
    startedAt: '2026-10-12 16:20',
    status: 'Valid',
    description: 'Multi-point voltage scale linearity calibration across 12-bit ADC channels.',
    sampleRecords: [
      { id: 'REC-011', timestamp: '16:20:05', channel: 'ADC_CH4', value: '1.65 V', hmacDigest: '94c1a7...30b2', status: 'Valid' },
      { id: 'REC-012', timestamp: '16:25:30', channel: 'ADC_CH4', value: '2.10 V', hmacDigest: '19fa22...73ac', status: 'Valid' },
      { id: 'REC-013', timestamp: '16:32:10', channel: 'ADC_CH4', value: '2.80 V', hmacDigest: '65de81...99bc', status: 'Valid' },
      { id: 'REC-014', timestamp: '16:45:18', channel: 'ADC_CH4', value: '3.30 V', hmacDigest: '80cd11...42ad', status: 'Valid' },
    ],
  },
  {
    id: 'SES-2026-0043',
    name: 'Bench Experiment',
    device: 'ESP32-LAB-01',
    dataSource: 'ESP32 Sensor',
    recordCount: 12,
    duration: '38m',
    startedAt: '2026-10-12 15:05',
    status: 'Warning',
    description: 'Manual rotary knob dial sweep under RF noise emitter. Minor transport jitter observed on frame 9.',
    sampleRecords: [
      { id: 'REC-021', timestamp: '15:05:12', channel: 'DIAL_POT', value: '45 %', hmacDigest: '29ea54...87fe', status: 'Valid' },
      { id: 'REC-022', timestamp: '15:12:00', channel: 'DIAL_POT', value: '68 %', hmacDigest: '51ff90...33aa', status: 'Valid' },
      { id: 'REC-023', timestamp: '15:20:44', channel: 'DIAL_POT', value: '92 %', hmacDigest: '74aa31...19cc', status: 'Warning' },
      { id: 'REC-024', timestamp: '15:35:10', channel: 'DIAL_POT', value: '68 %', hmacDigest: '98cc22...55dd', status: 'Valid' },
    ],
  },
  {
    id: 'SES-2026-0044',
    name: 'Voltage Test',
    device: 'ESP32-LAB-02',
    dataSource: 'ESP32 Sensor',
    recordCount: 14,
    duration: '47m',
    startedAt: '2026-10-12 13:50',
    status: 'Valid',
    description: '3.3V system bus rail stability test under continuous Wi-Fi transmission bursts.',
    sampleRecords: [
      { id: 'REC-031', timestamp: '13:50:01', channel: 'VBUS_MON', value: '3.31 V', hmacDigest: '30a91f...84db', status: 'Valid' },
      { id: 'REC-032', timestamp: '14:02:15', channel: 'VBUS_MON', value: '3.29 V', hmacDigest: '44e8c1...31da', status: 'Valid' },
      { id: 'REC-033', timestamp: '14:15:30', channel: 'VBUS_MON', value: '3.30 V', hmacDigest: '91d0e2...52bc', status: 'Valid' },
      { id: 'REC-034', timestamp: '14:32:00', channel: 'VBUS_MON', value: '3.32 V', hmacDigest: '37bc90...11ee', status: 'Valid' },
    ],
  },
  {
    id: 'SES-2026-0045',
    name: 'Manual Observation',
    device: 'Manual Input',
    dataSource: 'Manual',
    recordCount: 5,
    duration: '22m',
    startedAt: '2026-10-12 11:15',
    status: 'Invalid',
    description: 'Unsigned manual telemetry injection test. Flagged due to missing cryptographic enclave signature token.',
    sampleRecords: [
      { id: 'REC-041', timestamp: '11:15:00', channel: 'MANUAL_ENTRY', value: '25.0 °C', hmacDigest: 'NULL_SIGNATURE', status: 'Invalid' },
      { id: 'REC-042', timestamp: '11:18:20', channel: 'MANUAL_ENTRY', value: '25.1 °C', hmacDigest: 'MISMATCH_0xEE', status: 'Invalid' },
      { id: 'REC-043', timestamp: '11:25:40', channel: 'MANUAL_ENTRY', value: '25.0 °C', hmacDigest: 'KEY_REJECTED', status: 'Invalid' },
    ],
  },
  {
    id: 'SES-2026-0040',
    name: 'Thermal Baseline Run',
    device: 'ESP32-LAB-01',
    dataSource: 'ESP32 Sensor',
    recordCount: 0,
    duration: '0m',
    startedAt: '2026-10-11 20:00',
    status: 'Valid',
    description: 'Pre-flight standby calibration session. Hardware enclaves initialized.',
    sampleRecords: [],
  },
  {
    id: 'SES-2026-0039',
    name: 'Power Rail Ingestion',
    device: 'ESP32-LAB-02',
    dataSource: 'Sensor',
    recordCount: 0,
    duration: '0m',
    startedAt: '2026-10-11 18:30',
    status: 'Valid',
    description: 'Standby rail telemetry channel allocation.',
    sampleRecords: [],
  },
  {
    id: 'SES-2026-0038',
    name: 'Chamber Vacuum Seal',
    device: 'ESP32-LAB-01',
    dataSource: 'ESP32 Sensor',
    recordCount: 0,
    duration: '0m',
    startedAt: '2026-10-11 16:15',
    status: 'Valid',
    description: 'Barometric pressure sensor standby registration.',
    sampleRecords: [],
  },
  {
    id: 'SES-2026-0037',
    name: 'Oscillator Clock Sync',
    device: 'ESP32-LAB-02',
    dataSource: 'Sensor',
    recordCount: 0,
    duration: '0m',
    startedAt: '2026-10-11 14:00',
    status: 'Valid',
    description: 'Hardware RTC crystal frequency synchronization test.',
    sampleRecords: [],
  },
  {
    id: 'SES-2026-0036',
    name: 'Analog Filter Sweep',
    device: 'ESP32-LAB-01',
    dataSource: 'ESP32 Sensor',
    recordCount: 0,
    duration: '0m',
    startedAt: '2026-10-11 11:30',
    status: 'Valid',
    description: 'Low-pass filter attenuation frequency verification.',
    sampleRecords: [],
  },
  {
    id: 'SES-2026-0035',
    name: 'Memory Enclave Test',
    device: 'ESP32-LAB-02',
    dataSource: 'Sensor',
    recordCount: 0,
    duration: '0m',
    startedAt: '2026-10-10 17:00',
    status: 'Valid',
    description: 'Cryptographic keystore flash memory integrity verification.',
    sampleRecords: [],
  },
  {
    id: 'SES-2026-0034',
    name: 'Peripheral Bus Audit',
    device: 'ESP32-LAB-01',
    dataSource: 'ESP32 Sensor',
    recordCount: 0,
    duration: '0m',
    startedAt: '2026-10-10 14:15',
    status: 'Warning',
    description: 'Intermittent I2C pullup resistor voltage drop detected on bus scan.',
    sampleRecords: [],
  },
];
