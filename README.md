# Dog Pill Log (URL-Only)

Static HTML/CSS/JS tracker for a dog pill schedule (morning and evening).

The entire log is stored in the URL hash (`#d=...`). No database, cookies, or local storage are used.

See https://wind010.hashnode.dev/dog-medication-tracking

## How It Works

- Each day has 2 bits of state:
  - Morning not given / given
  - Evening not given / given
- This yields 4 encoded daily states: 0=None, 1=Morning, 2=Evening, 3=Both.
- The app stores a rolling 12-month window (typically 365 or 366 days).
- The binary payload starts with a 7-byte header:
  - Byte 0: version
  - Bytes 1-4: start epoch day (UInt32, big-endian)
  - Bytes 5-6: day count (UInt16, big-endian)
- Data is bit-packed into bytes and encoded as [Base64url](https://en.wikipedia.org/wiki/Base64#URL_applications).
- Literal digit characters are escaped with `~` so they are not mistaken for repeat counts (example: `~4` means the character `4`, not “repeat 4 times”).
- The Base64url text is then [run-length encoded](https://en.wikipedia.org/wiki/Run-length_encoding) for the URL hash.
- RLE uses no `1` suffix for single characters (example: `ABB` -> `AB2`).
- The packed body begins at byte 7 and stores 4 days per byte (2 bits per day).
- Header integers use big-endian byte order, but day-status packing within each byte is least-significant-bits first.
- A 2-byte [checksum](https://en.wikipedia.org/wiki/Checksum) trailer is appended for corruption detection.

```
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                                   RAW BYTE STREAM                                      │
 └────────────────────────────────────────────────────────────────────────────────────────┘
   │ Byte 0   │ Bytes 1 - 4       │ Bytes 5 - 6  │ Bytes 7 - 98         │ Bytes 99 - 100  │
   ├──────────┼───────────────────┼──────────────┼──────────────────────┼─────────────────┤
   │ Version  │ Start Epoch Day   │ Day Count    │ 2-Bit Packed Body    │ 16-Bit Checksum │
   │ (1 byte) │ (4 bytes, UInt32) │ (2 bytes)    │ (92 bytes, 365 days) │ (2 bytes)       │
   └──────────┴───────────────────┴──────────────┴──────────────────────┴─────────────────┘
   │ 0x01     │ 0x00 0x00 0x4F 0x2E  │ 0x01 0x6D    │ 0x0000...401D...00   │ 0x01 0x49    │
```

Bit-Packing Details (2 bits per day)
```
                      ONE BYTE (8 BITS)
 ┌─────────────────────────────────────────────────────────┐
 │  Day 4     │  Day 3     │  Day 2     │  Day 1     │
 ├────────────┼────────────┼────────────┼────────────┤
 │  M  │  E   │  M  │  E   │  M  │  E   │  M  │  E   │
 └─▲───┴──▲───┴─▲────┴──▲───┴─▲────┴──▲───┴─▲────┴──▲───┘
   │      │     │      │     │      │     │      │
 Bit 7   Bit 6 Bit 5  Bit 4 Bit 3  Bit 2 Bit 1  Bit 0

 (M = Morning given / E = Evening given; Day 1 is stored in bits 1:0)
```

The checksum logic is a 16-bit additive checksum (sum of payload bytes modulo 65536):
```
[ Read Base64url String ] ──► [ Decode to Uint8Array ]
                                      │
                                      ├──► Extract bytes 0 to 98 ──► [ Compute checksum16 ]
                                      │                                      │
                                      └──► Extract bytes 99, 100 ────────────┼──► [ Do they match? ]
                                                                             │
                                              ┌──────────────────────────────┴──────────────┐
                                              ▼                                             ▼
                                          [ MATCH ]                                    [ MISMATCH ]
                                      Data is pristine                              Data is corrupted
```



```
r.AQA2Ty~4BbQA123Ow
```

Example RLE fragments:
- `AB2` means `ABB`
- `~4` means a literal `4`
- a trailing letter like `w` is just a single literal character



## Run Locally

Open `index.html` in a browser.

Optional: use any simple static file server for local testing, but the app itself is pure client-side JavaScript.

## Deploy To GitHub Pages

1. Push this repo to GitHub.
2. In repository settings, open Pages.
3. Set source to deploy from the branch (usually `main`) and root (`/`).
4. Save.
5. Open the provided Pages URL.

GitHub Pages only serves static assets, which is exactly what this project uses (`index.html`, `styles.css`, `index.js`).

## Usage

1. Check morning/evening boxes for each day.
2. The URL updates automatically.
3. Share or bookmark the URL to keep the log state.

## Notes

- This is strict URL-only persistence.
- If URL data is invalid, the app starts a fresh log.
- A warning appears if URL length approaches conservative browser limits.

