/**
 * Compile-time description of the Arduino libraries the simulator implements: constructor
 * arity, methods ([min args, max args, return type]) and readable fields. Return types are a
 * base type name ('int', 'float', 'String' …), a library class name (returns an object), a
 * built-in struct name, or 'gen:<type>' for methods that take simulated time (the generated
 * code waits on them with `yield*`).
 */
export type MethodSpec = [min: number, max: number, ret: string];
export interface LibSpec {
  ctor: [number, number];
  methods: Record<string, MethodSpec>;
  fields?: Record<string, string>;
}

const PRINT: Record<string, MethodSpec> = {
  print: [1, 2, 'uint'], println: [0, 2, 'uint'], write: [1, 2, 'uint'], printf: [1, 16, 'uint'],
};
const STREAM: Record<string, MethodSpec> = {
  ...PRINT,
  available: [0, 0, 'int'], read: [0, 0, 'int'], peek: [0, 0, 'int'], flush: [0, 0, 'void'],
  parseInt: [0, 2, 'long'], parseFloat: [0, 2, 'float'], readString: [0, 0, 'String'], readStringUntil: [1, 1, 'String'],
  readBytes: [2, 2, 'uint'], readBytesUntil: [3, 3, 'uint'], setTimeout: [1, 1, 'void'], find: [1, 1, 'bool'], availableForWrite: [0, 0, 'int'],
};
const SERIAL: Record<string, MethodSpec> = { ...STREAM, begin: [0, 4, 'void'], end: [0, 0, 'void'], setRxBufferSize: [1, 1, 'void'] };

const LCD_METHODS: Record<string, MethodSpec> = {
  begin: [0, 3, 'void'], clear: [0, 0, 'void'], home: [0, 0, 'void'], setCursor: [2, 2, 'void'],
  print: [1, 2, 'uint'], println: [0, 2, 'uint'], write: [1, 1, 'uint'],
  cursor: [0, 0, 'void'], noCursor: [0, 0, 'void'], blink: [0, 0, 'void'], noBlink: [0, 0, 'void'],
  display: [0, 0, 'void'], noDisplay: [0, 0, 'void'], scrollDisplayLeft: [0, 0, 'void'], scrollDisplayRight: [0, 0, 'void'],
  autoscroll: [0, 0, 'void'], noAutoscroll: [0, 0, 'void'], leftToRight: [0, 0, 'void'], rightToLeft: [0, 0, 'void'],
  createChar: [2, 2, 'void'], command: [1, 1, 'void'],
};

const GFX: Record<string, MethodSpec> = {
  ...PRINT,
  drawPixel: [3, 3, 'void'], drawLine: [5, 5, 'void'], drawFastHLine: [4, 4, 'void'], drawFastVLine: [4, 4, 'void'],
  drawRect: [5, 5, 'void'], fillRect: [5, 5, 'void'], drawRoundRect: [6, 6, 'void'], fillRoundRect: [6, 6, 'void'],
  drawCircle: [4, 4, 'void'], fillCircle: [4, 4, 'void'], drawTriangle: [7, 7, 'void'], fillTriangle: [7, 7, 'void'],
  drawBitmap: [6, 7, 'void'], drawChar: [6, 7, 'void'], fillScreen: [1, 1, 'void'],
  setCursor: [2, 2, 'void'], setTextColor: [1, 2, 'void'], setTextSize: [1, 2, 'void'], setTextWrap: [1, 1, 'void'],
  setRotation: [1, 1, 'void'], getRotation: [0, 0, 'uchar'], width: [0, 0, 'int'], height: [0, 0, 'int'],
  getCursorX: [0, 0, 'int'], getCursorY: [0, 0, 'int'], cp437: [0, 1, 'void'], getTextBounds: [7, 7, 'void'],
};

const GPS_VALUE = (fields: Record<string, string>): LibSpec => ({
  ctor: [0, 0],
  methods: { isValid: [0, 0, 'bool'], isUpdated: [0, 0, 'bool'], age: [0, 0, 'ulong'], ...Object.fromEntries(Object.entries(fields).map(([k, t]) => [k, [0, 0, t] as MethodSpec])) },
});

export const LIBS: Record<string, LibSpec> = {
  // ---------------------------------------------------------------- core
  HardwareSerial: { ctor: [0, 0], methods: SERIAL },
  SoftwareSerial: { ctor: [2, 3], methods: { ...SERIAL, listen: [0, 0, 'bool'], isListening: [0, 0, 'bool'], overflow: [0, 0, 'bool'] } },
  TwoWire: {
    ctor: [0, 0],
    methods: {
      begin: [0, 3, 'void'], end: [0, 0, 'void'], setClock: [1, 1, 'void'], beginTransmission: [1, 1, 'void'],
      write: [1, 2, 'uint'], endTransmission: [0, 1, 'uchar'], requestFrom: [2, 3, 'uchar'], available: [0, 0, 'int'], read: [0, 0, 'int'],
      setPins: [2, 2, 'bool'],
    },
  },
  SPIClass: {
    ctor: [0, 1],
    methods: {
      begin: [0, 4, 'void'], end: [0, 0, 'void'], transfer: [1, 2, 'uchar'], transfer16: [1, 1, 'uint'],
      beginTransaction: [1, 1, 'void'], endTransaction: [0, 0, 'void'], setClockDivider: [1, 1, 'void'], setBitOrder: [1, 1, 'void'],
      setDataMode: [1, 1, 'void'], setFrequency: [1, 1, 'void'],
    },
  },
  SPISettings: { ctor: [0, 3], methods: {} },
  EEPROMClass: {
    ctor: [0, 0],
    methods: { read: [1, 1, 'uchar'], write: [2, 2, 'void'], update: [2, 2, 'void'], put: [2, 2, 'void'], get: [2, 2, 'void'], length: [0, 0, 'uint'], begin: [0, 1, 'bool'], commit: [0, 0, 'bool'], end: [0, 0, 'void'] },
  },
  // ---------------------------------------------------------------- displays / outputs
  Servo: {
    ctor: [0, 0],
    methods: { attach: [1, 3, 'uchar'], write: [1, 1, 'void'], writeMicroseconds: [1, 1, 'void'], read: [0, 0, 'int'], readMicroseconds: [0, 0, 'int'], attached: [0, 0, 'bool'], detach: [0, 0, 'void'] },
  },
  LiquidCrystal: { ctor: [6, 11], methods: LCD_METHODS },
  LiquidCrystal_I2C: { ctor: [3, 3], methods: { ...LCD_METHODS, init: [0, 0, 'void'], backlight: [0, 0, 'void'], noBacklight: [0, 0, 'void'], setBacklight: [1, 1, 'void'] } },
  Adafruit_NeoPixel: {
    ctor: [0, 3],
    methods: {
      begin: [0, 0, 'void'], show: [0, 0, 'void'], setPixelColor: [2, 5, 'void'], getPixelColor: [1, 1, 'ulong'], Color: [3, 4, 'ulong'],
      ColorHSV: [1, 3, 'ulong'], gamma32: [1, 1, 'ulong'], setBrightness: [1, 1, 'void'], getBrightness: [0, 0, 'uchar'], clear: [0, 0, 'void'],
      fill: [0, 3, 'void'], numPixels: [0, 0, 'uint'], setPin: [1, 1, 'void'], updateLength: [1, 1, 'void'], canShow: [0, 0, 'bool'], rainbow: [0, 5, 'void'],
    },
  },
  Adafruit_SSD1306: {
    ctor: [0, 7],
    methods: { ...GFX, begin: [0, 4, 'bool'], display: [0, 0, 'void'], clearDisplay: [0, 0, 'void'], invertDisplay: [1, 1, 'void'], dim: [1, 1, 'void'], startscrollright: [2, 2, 'void'], startscrollleft: [2, 2, 'void'], stopscroll: [0, 0, 'void'] },
  },
  LedControl: {
    ctor: [3, 4],
    methods: { shutdown: [2, 2, 'void'], setIntensity: [2, 2, 'void'], clearDisplay: [1, 1, 'void'], setLed: [4, 4, 'void'], setRow: [3, 3, 'void'], setColumn: [3, 3, 'void'], setDigit: [4, 4, 'void'], setChar: [4, 4, 'void'], setScanLimit: [2, 2, 'void'], getDeviceCount: [0, 0, 'int'] },
  },
  Adafruit_PWMServoDriver: {
    ctor: [0, 2],
    methods: { begin: [0, 1, 'bool'], reset: [0, 0, 'void'], sleep: [0, 0, 'void'], wakeup: [0, 0, 'void'], setPWMFreq: [1, 1, 'void'], setPWM: [3, 3, 'void'], setPin: [2, 3, 'void'], setOscillatorFrequency: [1, 1, 'void'], writeMicroseconds: [2, 2, 'void'], getPWM: [1, 2, 'uint'] },
  },
  Stepper: { ctor: [3, 5], methods: { setSpeed: [1, 1, 'void'], step: [1, 1, 'gen:void'] } },
  AccelStepper: {
    ctor: [0, 6],
    methods: {
      moveTo: [1, 1, 'void'], move: [1, 1, 'void'], run: [0, 0, 'bool'], runSpeed: [0, 0, 'bool'], setMaxSpeed: [1, 1, 'void'], maxSpeed: [0, 0, 'float'],
      setAcceleration: [1, 1, 'void'], setSpeed: [1, 1, 'void'], speed: [0, 0, 'float'], distanceToGo: [0, 0, 'long'], targetPosition: [0, 0, 'long'],
      currentPosition: [0, 0, 'long'], setCurrentPosition: [1, 1, 'void'], runToPosition: [0, 0, 'gen:void'], runToNewPosition: [1, 1, 'gen:void'],
      stop: [0, 0, 'void'], isRunning: [0, 0, 'bool'], enableOutputs: [0, 0, 'void'], disableOutputs: [0, 0, 'void'], setEnablePin: [1, 1, 'void'],
      setPinsInverted: [0, 5, 'void'], runSpeedToPosition: [0, 0, 'bool'],
    },
  },
  // ---------------------------------------------------------------- input
  Keypad: {
    ctor: [5, 5],
    methods: { getKey: [0, 0, 'gen:char'], waitForKey: [0, 0, 'gen:char'], getState: [0, 0, 'int'], isPressed: [1, 1, 'gen:bool'], setDebounceTime: [1, 1, 'void'], setHoldTime: [1, 1, 'void'], keyStateChanged: [0, 0, 'bool'] },
  },
  NewPing: { ctor: [2, 3], methods: { ping: [0, 1, 'gen:ulong'], ping_cm: [0, 1, 'gen:ulong'], ping_in: [0, 1, 'gen:ulong'], ping_median: [0, 2, 'gen:ulong'], convert_cm: [1, 1, 'ulong'], convert_in: [1, 1, 'ulong'] } },
  // ---------------------------------------------------------------- sensors
  DHT: {
    ctor: [2, 3],
    methods: { begin: [0, 1, 'void'], readTemperature: [0, 2, 'float'], readHumidity: [0, 1, 'float'], computeHeatIndex: [2, 3, 'float'], convertCtoF: [1, 1, 'float'], convertFtoC: [1, 1, 'float'], read: [0, 1, 'bool'] },
  },
  Adafruit_BMP280: {
    ctor: [0, 4],
    methods: { begin: [0, 2, 'bool'], readTemperature: [0, 0, 'float'], readPressure: [0, 0, 'float'], readAltitude: [0, 1, 'float'], setSampling: [0, 5, 'void'], sensorID: [0, 0, 'uint'], seaLevelForAltitude: [2, 2, 'float'] },
  },
  Adafruit_MPU6050: {
    ctor: [0, 0],
    methods: {
      begin: [0, 3, 'bool'], getEvent: [3, 3, 'bool'], setAccelerometerRange: [1, 1, 'void'], setGyroRange: [1, 1, 'void'], setFilterBandwidth: [1, 1, 'void'],
      getAccelerometerRange: [0, 0, 'int'], getGyroRange: [0, 0, 'int'], getFilterBandwidth: [0, 0, 'int'], setTemperatureStandby: [1, 1, 'void'], reset: [0, 0, 'void'],
    },
  },
  QMC5883LCompass: {
    ctor: [0, 0],
    methods: { init: [0, 0, 'void'], read: [0, 0, 'void'], getX: [0, 0, 'int'], getY: [0, 0, 'int'], getZ: [0, 0, 'int'], getAzimuth: [0, 0, 'int'], getBearing: [1, 1, 'uchar'], setCalibration: [6, 6, 'void'], setSmoothing: [2, 2, 'void'], setADDR: [1, 1, 'void'], setMagneticDeclination: [2, 2, 'void'], setReset: [0, 0, 'void'], setMode: [4, 4, 'void'] },
  },
  Adafruit_INA219: {
    ctor: [0, 1],
    methods: { begin: [0, 1, 'bool'], getBusVoltage_V: [0, 0, 'float'], getShuntVoltage_mV: [0, 0, 'float'], getCurrent_mA: [0, 0, 'float'], getPower_mW: [0, 0, 'float'], setCalibration_32V_2A: [0, 0, 'void'], setCalibration_32V_1A: [0, 0, 'void'], setCalibration_16V_400mA: [0, 0, 'void'], powerSave: [1, 1, 'void'], success: [0, 0, 'bool'] },
  },
  Adafruit_ADS1115: {
    ctor: [0, 0],
    methods: { begin: [0, 2, 'bool'], readADC_SingleEnded: [1, 1, 'int'], readADC_Differential_0_1: [0, 0, 'int'], readADC_Differential_2_3: [0, 0, 'int'], readADC_Differential_0_3: [0, 0, 'int'], readADC_Differential_1_3: [0, 0, 'int'], computeVolts: [1, 1, 'float'], setGain: [1, 1, 'void'], getGain: [0, 0, 'int'], setDataRate: [1, 1, 'void'] },
  },
  Adafruit_MCP4725: { ctor: [0, 0], methods: { begin: [0, 2, 'bool'], setVoltage: [2, 4, 'bool'] } },
  PCF8574: {
    ctor: [0, 2],
    methods: {
      begin: [0, 3, 'bool'], isConnected: [0, 0, 'bool'], read8: [0, 0, 'uchar'], write8: [1, 1, 'void'], read: [1, 1, 'uchar'], write: [2, 2, 'void'], toggle: [1, 1, 'void'],
      pinMode: [2, 2, 'void'], digitalWrite: [2, 2, 'void'], digitalRead: [1, 1, 'int'], valueOut: [0, 0, 'uchar'], lastError: [0, 0, 'int'],
    },
  },
  // ---------------------------------------------------------------- time & storage
  RTC_DS3231: { ctor: [0, 0], methods: { begin: [0, 1, 'bool'], now: [0, 0, 'DateTime'], adjust: [1, 1, 'void'], lostPower: [0, 0, 'bool'], getTemperature: [0, 0, 'float'] } },
  RTC_DS1307: { ctor: [0, 0], methods: { begin: [0, 1, 'bool'], now: [0, 0, 'DateTime'], adjust: [1, 1, 'void'], isrunning: [0, 0, 'bool'] } },
  RTC_Millis: { ctor: [0, 0], methods: { begin: [0, 1, 'bool'], now: [0, 0, 'DateTime'], adjust: [1, 1, 'void'] } },
  DateTime: {
    ctor: [0, 7],
    methods: {
      year: [0, 0, 'uint'], month: [0, 0, 'uchar'], day: [0, 0, 'uchar'], hour: [0, 0, 'uchar'], minute: [0, 0, 'uchar'], second: [0, 0, 'uchar'],
      dayOfTheWeek: [0, 0, 'uchar'], unixtime: [0, 0, 'ulong'], secondstime: [0, 0, 'ulong'], timestamp: [0, 1, 'String'], isValid: [0, 0, 'bool'], twelveHour: [0, 0, 'uchar'], isPM: [0, 0, 'uchar'],
    },
  },
  SDClass: { ctor: [0, 0], methods: { begin: [0, 2, 'bool'], exists: [1, 1, 'bool'], mkdir: [1, 1, 'bool'], remove: [1, 1, 'bool'], rmdir: [1, 1, 'bool'], open: [1, 2, 'File'] } },
  File: {
    ctor: [0, 0],
    methods: { ...STREAM, close: [0, 0, 'void'], size: [0, 0, 'ulong'], position: [0, 0, 'ulong'], seek: [1, 1, 'bool'], name: [0, 0, 'String'], isDirectory: [0, 0, 'bool'], openNextFile: [0, 1, 'File'], rewindDirectory: [0, 0, 'void'] },
  },
  // ---------------------------------------------------------------- RFID / NFC / radio / CAN
  MFRC522: {
    ctor: [0, 2],
    methods: {
      PCD_Init: [0, 2, 'void'], PICC_IsNewCardPresent: [0, 0, 'bool'], PICC_ReadCardSerial: [0, 0, 'bool'], PICC_HaltA: [0, 0, 'void'], PCD_StopCrypto1: [0, 0, 'void'],
      PCD_DumpVersionToSerial: [0, 0, 'void'], PICC_DumpToSerial: [1, 1, 'void'], PCD_PerformSelfTest: [0, 0, 'bool'], PICC_GetType: [1, 1, 'uchar'], PICC_GetTypeName: [1, 1, 'String'],
    },
    fields: { uid: 'Uid' },
  },
  Adafruit_PN532: {
    ctor: [1, 4],
    methods: { begin: [0, 0, 'bool'], getFirmwareVersion: [0, 0, 'ulong'], SAMConfig: [0, 0, 'bool'], readPassiveTargetID: [4, 5, 'bool'], setPassiveActivationRetries: [1, 1, 'bool'], PrintHex: [2, 2, 'void'] },
  },
  RF24: {
    ctor: [2, 3],
    methods: {
      begin: [0, 0, 'bool'], isChipConnected: [0, 0, 'bool'], openWritingPipe: [1, 1, 'void'], openReadingPipe: [2, 2, 'void'], closeReadingPipe: [1, 1, 'void'],
      startListening: [0, 0, 'void'], stopListening: [0, 0, 'void'], write: [2, 3, 'bool'], available: [0, 1, 'bool'], read: [2, 2, 'void'],
      setPALevel: [1, 2, 'void'], setDataRate: [1, 1, 'bool'], setChannel: [1, 1, 'void'], getChannel: [0, 0, 'uchar'], setRetries: [2, 2, 'void'], setAutoAck: [1, 2, 'void'],
      setPayloadSize: [1, 1, 'void'], enableDynamicPayloads: [0, 0, 'void'], getDynamicPayloadSize: [0, 0, 'uchar'], powerUp: [0, 0, 'void'], powerDown: [0, 0, 'void'], printDetails: [0, 0, 'void'], testCarrier: [0, 0, 'bool'], flush_rx: [0, 0, 'void'], flush_tx: [0, 0, 'void'],
    },
  },
  MCP_CAN: {
    ctor: [1, 1],
    methods: { begin: [3, 3, 'uchar'], setMode: [1, 1, 'uchar'], sendMsgBuf: [3, 4, 'uchar'], readMsgBuf: [3, 4, 'uchar'], checkReceive: [0, 0, 'uchar'], checkError: [0, 0, 'uchar'], getCanId: [0, 0, 'ulong'], init_Mask: [3, 3, 'uchar'], init_Filt: [3, 3, 'uchar'] },
  },
  // ---------------------------------------------------------------- GPS
  TinyGPSPlus: {
    ctor: [0, 0],
    methods: { encode: [1, 1, 'bool'], charsProcessed: [0, 0, 'ulong'], sentencesWithFix: [0, 0, 'ulong'], failedChecksum: [0, 0, 'ulong'], passedChecksum: [0, 0, 'ulong'], distanceBetween: [4, 4, 'float'], courseTo: [4, 4, 'float'] },
    fields: { location: 'TinyGPSLocation', date: 'TinyGPSDate', time: 'TinyGPSTime', speed: 'TinyGPSSpeed', course: 'TinyGPSCourse', altitude: 'TinyGPSAltitude', satellites: 'TinyGPSInteger', hdop: 'TinyGPSHDOP' },
  },
  TinyGPSLocation: GPS_VALUE({ lat: 'float', lng: 'float' }),
  TinyGPSDate: GPS_VALUE({ year: 'uint', month: 'uchar', day: 'uchar', value: 'ulong' }),
  TinyGPSTime: GPS_VALUE({ hour: 'uchar', minute: 'uchar', second: 'uchar', centisecond: 'uchar', value: 'ulong' }),
  TinyGPSSpeed: GPS_VALUE({ knots: 'float', mph: 'float', mps: 'float', kmph: 'float', value: 'long' }),
  TinyGPSCourse: GPS_VALUE({ deg: 'float', value: 'long' }),
  TinyGPSAltitude: GPS_VALUE({ meters: 'float', miles: 'float', kilometers: 'float', feet: 'float', value: 'long' }),
  TinyGPSInteger: GPS_VALUE({ value: 'ulong' }),
  TinyGPSHDOP: GPS_VALUE({ hdop: 'float', value: 'long' }),
};

/** Library objects that exist without being declared (and the runtime expression for them). */
export const GLOBAL_OBJECTS: Record<string, [cls: string, js: string]> = {
  Serial: ['HardwareSerial', 'R.uart(0)'],
  Serial1: ['HardwareSerial', 'R.uart(1)'],
  Serial2: ['HardwareSerial', 'R.uart(2)'],
  Serial3: ['HardwareSerial', 'R.uart(3)'],
  Wire: ['TwoWire', 'R.wire'],
  SPI: ['SPIClass', 'R.spi'],
  EEPROM: ['EEPROMClass', 'R.eeprom'],
  SD: ['SDClass', 'R.sd'],
};

/** Library classes whose objects behave like values (can be assigned and returned). */
export const VALUE_CLASSES = new Set(['DateTime', 'File', 'SPISettings', 'TinyGPSLocation', 'TinyGPSDate', 'TinyGPSTime', 'TinyGPSSpeed', 'TinyGPSCourse', 'TinyGPSAltitude', 'TinyGPSInteger', 'TinyGPSHDOP']);

/** Library constants (numbers). */
export const LIB_CONSTANTS: Record<string, number> = {
  // NeoPixel
  NEO_GRB: 0x52, NEO_RGB: 0x06, NEO_RGBW: 0x1b, NEO_GRBW: 0xd2, NEO_BRG: 0x58, NEO_KHZ800: 0x0000, NEO_KHZ400: 0x0100,
  // SSD1306 / GFX
  SSD1306_SWITCHCAPVCC: 2, SSD1306_EXTERNALVCC: 1, SSD1306_WHITE: 1, SSD1306_BLACK: 0, SSD1306_INVERSE: 2, WHITE: 1, BLACK: 0, INVERSE: 2,
  // DHT
  DHT11: 11, DHT12: 12, DHT21: 21, DHT22: 22, AM2301: 21,
  // Keypad
  NO_KEY: 0, IDLE: 0, PRESSED: 1, HOLD: 2, RELEASED: 3,
  // AccelStepper
  FUNCTION: 0, DRIVER: 1, FULL2WIRE: 2, FULL3WIRE: 3, FULL4WIRE: 4, HALF3WIRE: 6, HALF4WIRE: 8,
  // MPU6050
  MPU6050_RANGE_2_G: 0, MPU6050_RANGE_4_G: 1, MPU6050_RANGE_8_G: 2, MPU6050_RANGE_16_G: 3,
  MPU6050_RANGE_250_DEG: 0, MPU6050_RANGE_500_DEG: 1, MPU6050_RANGE_1000_DEG: 2, MPU6050_RANGE_2000_DEG: 3,
  MPU6050_BAND_260_HZ: 0, MPU6050_BAND_184_HZ: 1, MPU6050_BAND_94_HZ: 2, MPU6050_BAND_44_HZ: 3, MPU6050_BAND_21_HZ: 4, MPU6050_BAND_10_HZ: 5, MPU6050_BAND_5_HZ: 6,
  // ADS1115 gains
  GAIN_TWOTHIRDS: 0x0000, GAIN_ONE: 0x0200, GAIN_TWO: 0x0400, GAIN_FOUR: 0x0600, GAIN_EIGHT: 0x0800, GAIN_SIXTEEN: 0x0a00,
  // SD
  FILE_READ: 0x01, FILE_WRITE: 0x13, O_READ: 0x01, O_WRITE: 0x02, O_APPEND: 0x04, O_CREAT: 0x10,
  // RF24
  RF24_PA_MIN: 0, RF24_PA_LOW: 1, RF24_PA_HIGH: 2, RF24_PA_MAX: 3, RF24_1MBPS: 0, RF24_2MBPS: 1, RF24_250KBPS: 2,
  // MCP2515
  MCP_ANY: 0, MCP_STDEXT: 1, MCP_STD: 2, MCP_EXT: 3, MCP_8MHZ: 1, MCP_16MHZ: 2, MCP_20MHZ: 3, MCP_NORMAL: 0, MCP_LOOPBACK: 0x40, MCP_LISTENONLY: 0x60,
  CAN_OK: 0, CAN_FAILINIT: 1, CAN_FAILTX: 2, CAN_MSGAVAIL: 3, CAN_NOMSG: 4, CAN_CTRLERROR: 5, CAN_FAIL: 0xff,
  CAN_5KBPS: 1, CAN_10KBPS: 2, CAN_20KBPS: 3, CAN_50KBPS: 7, CAN_100KBPS: 9, CAN_125KBPS: 10, CAN_250KBPS: 13, CAN_500KBPS: 15, CAN_1000KBPS: 18,
  // PN532
  PN532_MIFARE_ISO14443A: 0,
  // SPI
  SPI_MODE0: 0, SPI_MODE1: 1, SPI_MODE2: 2, SPI_MODE3: 3, SPI_CLOCK_DIV2: 4, SPI_CLOCK_DIV4: 0, SPI_CLOCK_DIV8: 5, SPI_CLOCK_DIV16: 1, SPI_CLOCK_DIV32: 6, SPI_CLOCK_DIV64: 2, SPI_CLOCK_DIV128: 3,
  // Serial configs
  SERIAL_8N1: 0x06, SERIAL_8N2: 0x0e, SERIAL_8E1: 0x26, SERIAL_7E1: 0x24,
};

/** Library-defined structs (field names and types), e.g. Adafruit's sensors_event_t. */
export const LIB_STRUCTS: Record<string, [string, string, number?][]> = {
  sensors_vec_t: [['x', 'float'], ['y', 'float'], ['z', 'float'], ['roll', 'float'], ['pitch', 'float'], ['heading', 'float']],
  sensors_event_t: [
    ['version', 'long'], ['sensor_id', 'long'], ['type', 'long'], ['timestamp', 'long'],
    ['acceleration', 'sensors_vec_t'], ['gyro', 'sensors_vec_t'], ['magnetic', 'sensors_vec_t'], ['orientation', 'sensors_vec_t'],
    ['temperature', 'float'], ['pressure', 'float'], ['relative_humidity', 'float'], ['light', 'float'], ['distance', 'float'], ['current', 'float'], ['voltage', 'float'],
  ],
  Uid: [['size', 'uchar'], ['uidByte', 'uchar', 10], ['sak', 'uchar']],
};

/** Hints for libraries/objects that are recognised but not simulated. */
export const UNSUPPORTED_OBJECTS: Record<string, string> = {
  FastLED: 'FastLED is not supported — use the Adafruit_NeoPixel library instead (same LEDs).',
  WiFi: 'WiFi networking isn’t simulated. Use an ESP-01 module over serial to see AT-command Wi-Fi, or test the rest of your sketch without it.',
  SerialBT: 'Bluetooth Classic isn’t simulated on the ESP32 — use an HC-05 module on a serial port instead.',
  WebServer: 'WebServer isn’t simulated (no network).',
  HTTPClient: 'HTTPClient isn’t simulated (no network).',
  BLEDevice: 'Bluetooth LE isn’t simulated.',
  esp_now: 'ESP-NOW isn’t simulated — try two nRF24L01 modules for a radio link.',
};
