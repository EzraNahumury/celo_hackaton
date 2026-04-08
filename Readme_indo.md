# Trickle - Payroll Streaming di Celo

> **"Digaji setiap detik. Didukung oleh stablecoin Celo."**

Trickle adalah platform payroll streaming terdesentralisasi yang dibangun sebagai **MiniApp untuk MiniPay** di blockchain **Celo**. Terinspirasi dari [LlamaPay](https://llamapay.io/), Trickle membawa streaming gaji real-time ke ekosistem stablecoin Celo — memungkinkan pemberi kerja membayar karyawan **per-detik** menggunakan cUSD, USDC, dan USDT.

---

## Pernyataan Masalah

Di pasar negara berkembang, payroll itu bermasalah:

- **Pekerja menunggu berminggu-minggu atau berbulan-bulan** untuk menerima gaji mereka, menciptakan tekanan arus kas
- **Tidak ada solusi payroll streaming di Celo** — padahal Celo memiliki infrastruktur stablecoin terbaik untuk pembayaran mobile
- **LlamaPay tidak di-deploy di Celo** — pekerja di ekosistem Celo tidak punya akses ke streaming gaji real-time
- **Payroll tradisional berbasis batch** — pembayaran bulanan atau dua mingguan yang tidak sesuai dengan cara orang menggunakan uang (harian)

Sementara itu, Celo memiliki **14M+ pengguna MiniPay**, biaya transaksi sub-sen, dan dukungan stablecoin native — infrastruktur sempurna untuk payroll streaming, tapi belum ada yang membangunnya.

## Solusi

**Trickle** membawa payroll streaming real-time ke Celo:

1. Pemberi kerja mendepositkan stablecoin (cUSD, USDC, atau USDT) ke Trickle
2. Membuat stream gaji ke setiap karyawan dengan rate per-detik
3. Karyawan bisa **withdraw gaji yang sudah didapat kapan saja** — tidak perlu menunggu hari gajian
4. Semuanya berjalan melalui **MiniPay**, wallet mobile yang sudah digunakan jutaan orang

Simpel. Tanpa kompleksitas. Hanya streaming gaji yang didukung stablecoin Celo.

---

## Keunggulan Utama vs LlamaPay

| Fitur | LlamaPay | Trickle |
|-------|----------|-----------|
| Streaming gaji real-time | Ya | Ya |
| Deploy di Celo | **Tidak** | **Ya** |
| Integrasi MiniPay | **Tidak** | **Ya** |
| Mobile-first (MiniPay) | **Tidak** (web saja) | **Ya** |
| Dukungan stablecoin native Celo (cUSD) | **Tidak** | **Ya** |
| Dukungan stablecoin (USDC, USDT) | Chain terbatas | **Native di Celo** |
| Biaya withdrawal sub-sen | Tergantung chain | **Ya** (Celo) |

**LlamaPay tidak di-deploy di Celo** — ini adalah celah yang jelas di pasar. Trickle mengisi celah ini dengan membawa payroll streaming ke 14M+ pengguna MiniPay Celo dengan dukungan stablecoin native.

---

## Cara Kerja

### Alur Arsitektur

```
┌─────────────┐     Deposit Stablecoin      ┌──────────────────┐
│  Pemberi     │ ──────────────────────────> │  Trickle       │
│  Kerja       │                             │  Smart Contract  │
└─────────────┘                             └────────┬─────────┘
                                                      │
                                      Stream gaji      │
                                      per-detik        │
                                                      ▼
┌─────────────┐    Withdraw kapan saja      ┌──────────────────┐
│  Karyawan   │ <─────────────────────────│  Trickle       │
│  (Penerima) │   via MiniPay               │  Streaming Engine│
└─────────────┘                             └──────────────────┘
```

### Alur Detail

#### Alur Pemberi Kerja (Payer):
1. **Hubungkan wallet MiniPay** ke Trickle MiniApp
2. **Buat stream payroll** — atur alamat karyawan, token (cUSD/USDC/USDT), jumlah gaji bulanan
3. **Depositkan stablecoin** — dana disimpan di kontrak Trickle
4. **Pantau dashboard** — lihat semua stream aktif, total deposit, sisa saldo
5. **Top up saldo** jika diperlukan

#### Alur Karyawan (Payee):
1. **Hubungkan wallet MiniPay** ke Trickle MiniApp
2. **Lihat stream masuk** — lihat gaji bertambah secara real-time (per-detik)
3. **Withdraw kapan saja** — klaim gaji yang sudah terkumpul langsung ke wallet MiniPay
4. **Pantau penghasilan** — lihat total yang didapat, riwayat withdrawal

#### Di Balik Layar:
1. Pemberi kerja mendepositkan 10,000 cUSD ke kontrak Trickle
2. Membuat stream ke karyawan dengan rate ~0.00038 cUSD/detik ($1,000/bulan)
3. Saldo yang bisa diklaim karyawan bertambah setiap detik
4. Karyawan withdraw 500 cUSD setelah 2 minggu — biaya transaksi < $0.01 di Celo
5. Sisa saldo terus di-streaming sampai stream berakhir atau dibatalkan

---

## Arsitektur Smart Contract

```
┌────────────────────────┐
│  TrickleFactory      │  ← Membuat instance Trickle per pemberi kerja
│  (CREATE2)             │
└───────────┬────────────┘
            │ deploy
            ▼
┌────────────────────────┐
│  TrickleVault        │
│                        │
│  - createStream()      │
│  - deposit()           │
│  - withdraw()          │
│  - cancelStream()      │
│  - getBalance()        │
│  - streams mapping     │
│  - balances mapping    │
└────────────────────────┘
```

### Fungsi Utama Smart Contract

```solidity
// Fungsi Pemberi Kerja
deposit(address token, uint256 amount)
    → Transfer stablecoin ke kontrak, update saldo internal

createStream(address payee, address token, uint216 amountPerSec)
    → Buat stream gaji real-time ke karyawan

cancelStream(address payee, address token, uint216 amountPerSec)
    → Hentikan stream, selesaikan jumlah yang tertunda

// Fungsi Karyawan
withdraw(address payer, address token, uint216 amountPerSec)
    → Klaim gaji yang terkumpul ke wallet

// Fungsi View
getBalance(address payer) → (int256)
    → Mengembalikan sisa saldo payer

getStreamInfo(bytes32 streamId) → (Stream)
    → Mengembalikan detail stream
```

### Stablecoin yang Didukung di Celo

| Token | Deskripsi | Alamat |
|-------|-----------|--------|
| **cUSD** | Stablecoin USD native Celo | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |
| **USDC** | USDC dari Circle di Celo | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| **USDT** | USDT dari Tether di Celo | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` |

> Celo memiliki dukungan stablecoin kelas satu — cUSD adalah stablecoin native, dan USDC/USDT tersedia secara luas di jaringan.

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Blockchain** | Celo Mainnet |
| **Smart Contracts** | Solidity ^0.8.0, Hardhat |
| **Frontend** | Next.js / React |
| **Wallet** | MiniPay SDK (MiniPay Hook) |
| **Deployment** | Vercel |
| **Starter Kit** | [celo-composer](https://github.com/celo-org/celo-composer) |
| **Stablecoin** | cUSD, USDC, USDT |

---

## Fitur

### MVP (Proof of Ship - April 2026)

- [ ] Integrasi wallet MiniPay (MiniPay Hook)
- [ ] Dashboard pemberi kerja — buat & kelola stream payroll
- [ ] Dashboard karyawan — lihat stream gaji & withdraw
- [ ] Streaming gaji real-time (per-detik)
- [ ] Dukungan multi-stablecoin (cUSD, USDC, USDT)
- [ ] Manajemen stream (buat, jeda, batalkan)
- [ ] Withdrawal instan dengan biaya sub-sen di Celo
- [ ] Deploy di Celo Mainnet

### Roadmap Masa Depan

- [ ] Batch payroll — import CSV untuk banyak karyawan
- [ ] Dashboard analitik payroll untuk pemberi kerja & karyawan
- [ ] Sistem notifikasi (peringatan saldo rendah, pembayaran diterima)
- [ ] Dukungan multi-sig / Gnosis Safe untuk enterprise
- [ ] Integrasi fiat on/off ramp
- [ ] NFT slip gaji karyawan (bukti pembayaran onchain)

---

## Antarmuka Pengguna (Layar MiniApp)

### 1. Beranda / Hubungkan Wallet
- Hubungkan via MiniPay
- Pilih peran: Pemberi Kerja atau Karyawan

### 2. Dashboard Pemberi Kerja
- Total deposit & sisa saldo
- Daftar stream aktif dengan status real-time
- Tombol buat stream baru
- Tombol top up saldo

### 3. Buat Stream
- Input alamat wallet karyawan
- Pilih stablecoin (cUSD / USDC / USDT)
- Jumlah gaji bulanan
- Review & konfirmasi → deposit + buat stream

### 4. Dashboard Karyawan
- Stream masuk dengan penghitung akumulasi real-time
- Total gaji yang didapat
- Riwayat withdrawal
- Tombol withdraw

### 5. Withdraw
- Menampilkan total gaji yang bisa diklaim
- Withdraw sekali ketuk ke wallet MiniPay
- Biaya transaksi sub-sen di Celo

---

## Contoh Skenario

> **Perusahaan ABC** membayar 5 karyawan masing-masing $1,000/bulan dalam cUSD di Celo.

| Langkah | Aksi | Detail |
|---------|------|--------|
| 1 | Perusahaan deposit | **5,000 cUSD** ke Trickle |
| 2 | Buat 5 stream | Masing-masing ~$0.00038 cUSD/detik |
| 3 | Karyawan cek saldo | Lihat gaji bertambah setiap detik di MiniPay |
| 4 | Karyawan withdraw tengah bulan | Dapat **$500 cUSD** langsung, biaya < $0.01 |
| 5 | Akhir bulan | Sisa **$500 cUSD** tersedia untuk di-withdraw |

- Tidak perlu menunggu hari gajian — withdraw gaji yang sudah didapat **kapan saja**
- Biaya withdrawal **kurang dari $0.01** di Celo — sempurna untuk withdrawal kecil yang sering
- Berjalan di **MiniPay** — tidak perlu desktop, sepenuhnya mobile

---

## Kenapa Celo?

| Keunggulan | Detail |
|------------|--------|
| **Chain stablecoin-first** | cUSD adalah stablecoin native — Celo dibangun untuk stablecoin |
| **Biaya sub-sen** | Ideal untuk micro-withdrawal yang sering dalam streaming |
| **MiniPay** | 14M+ pengguna, channel distribusi bawaan |
| **Mobile-first** | Dirancang untuk pasar berkembang di mana payroll mobile penting |
| **Bayar gas pakai stablecoin** | Pengguna bisa bayar biaya transaksi pakai cUSD — tidak perlu punya CELO |
| **Stablecoin native** | cUSD, USDC, USDT semua tersedia secara native |
| **Finalitas cepat** | ~5 detik block time untuk UX streaming real-time |
| **Kompatibel EVM** | Manfaatkan ekosistem Solidity yang sudah ada |

---

## Memulai (Development)

```bash
# Clone repo
git clone https://github.com/<your-username>/trickle.git
cd trickle

# Install dependensi
npm install

# Setup variabel environment
cp .env.example .env
# Tambahkan private key (JANGAN PERNAH pakai wallet utama untuk dev!)
# Tambahkan Celo RPC URL

# Compile smart contract
npx hardhat compile

# Deploy ke Celo testnet (Alfajores)
npx hardhat deploy --network alfajores

# Jalankan frontend
cd frontend
npm run dev
```

### Token Testnet
- **Celo Sepolia (CELO)**: https://faucet.celo.org/celo-sepolia
- **USDC & EURC testnet**: https://faucet.circle.com/

---

## Tim

- **Ezra Kristanto Nahumury** — Full Stack Developer

---

## Tautan

| Resource | URL |
|----------|-----|
| Proof of Ship | [talent.app/~/earn/celo-proof-of-ship](https://talent.app/~/earn/celo-proof-of-ship) |
| Celo Docs | [docs.celo.org](https://docs.celo.org/) |
| MiniPay Docs | [docs.celo.org/build-on-minipay](https://docs.celo.org/developer/build-on-minipay/overview) |
| LlamaPay (Referensi) | [llamapay.io](https://llamapay.io/) |
| Telegram | [t.me/proofofship](https://t.me/proofofship) |

---

## Lisensi

MIT — Open Source sesuai syarat eligibilitas Proof of Ship.
