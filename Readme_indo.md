# StakeFlow - Payroll Streaming dengan Yield di Celo

> **"Gaji kamu menghasilkan yield bahkan sebelum sampai ke dompetmu."**

StakeFlow adalah platform payroll streaming terdesentralisasi yang dibangun sebagai **MiniApp untuk MiniPay** di blockchain **Celo**. Terinspirasi dari [LlamaPay](https://llamapay.io/), StakeFlow membawa payroll streaming ke level berikutnya dengan **men-staking dana payroll yang menganggur di Aave V3** — sehingga karyawan tidak hanya menerima gaji, tapi juga mendapatkan yield tambahan di atasnya.

---

## Pernyataan Masalah

Solusi payroll crypto tradisional (seperti LlamaPay) melakukan streaming gaji secara real-time, yang memang bagus. Tapi dana yang didepositkan hanya **diam saja** di smart contract, tidak menghasilkan apa-apa. Ini adalah peluang yang terlewatkan:

- **Pemberi kerja** mengunci sejumlah besar modal yang tidak menghasilkan return sama sekali
- **Karyawan** hanya menerima gaji pokok tanpa manfaat tambahan
- **Miliaran dolar** cadangan payroll di DeFi tidak produktif

Sementara itu, protokol lending seperti Aave di Celo menawarkan **0.5% - 2.6% APY** untuk stablecoin. Kenapa tidak membuat modal yang menganggur itu bekerja?

## Solusi

**StakeFlow** menyelesaikan masalah ini dengan mengintegrasikan payroll streaming dengan DeFi yield:

1. Pemberi kerja mendepositkan stablecoin ke StakeFlow
2. Dana **otomatis disuplai ke Aave V3 di Celo**, menghasilkan yield
3. Gaji di-streaming ke karyawan secara **real-time (per-detik)**
4. Ketika karyawan withdraw, mereka menerima **gaji + yield staking proporsional**

Ini menciptakan situasi win-win: karyawan mendapat lebih, dan protokol mendorong aktivitas onchain nyata di Celo.

---

## Keunggulan Utama vs LlamaPay

| Fitur | LlamaPay | StakeFlow |
|-------|----------|-----------|
| Streaming gaji real-time | Ya | Ya |
| Deploy di Celo | **Tidak** | **Ya** |
| Integrasi MiniPay | **Tidak** | **Ya** |
| Yield dari deposit menganggur | **Tidak** (dana diam saja) | **Ya** (staking Aave V3) |
| Karyawan dapat yield tambahan | **Tidak** | **Ya** |
| Mobile-first (MiniPay) | **Tidak** (web saja) | **Ya** |
| Dukungan stablecoin (cUSD, USDC, USDT) | Chain terbatas | **Stablecoin native Celo** |

**LlamaPay tidak di-deploy di Celo** — ini adalah celah yang jelas di pasar. StakeFlow mengisi celah ini sambil menambahkan yield generation sebagai value proposition yang unik.

---

## Cara Kerja

### Alur Arsitektur

```
┌─────────────┐     Deposit Stablecoin      ┌──────────────────┐
│  Pemberi     │ ──────────────────────────> │  StakeFlow       │
│  Kerja       │                             │  Smart Contract  │
└─────────────┘                             └────────┬─────────┘
                                                      │
                                       Otomatis supply │
                                       ke Aave V3     │
                                                      ▼
                                            ┌──────────────────┐
                                            │  Aave V3 (Celo)  │
                                            │  Lending Pool     │
                                            │                   │
                                            │  Deposit          │
                                            │  menghasilkan     │
                                            │  yield (APY)      │
                                            └────────┬─────────┘
                                                      │
                                   aTokens (token      │
                                   berbunga)           │
                                                      ▼
┌─────────────┐    Gaji + Yield             ┌──────────────────┐
│  Karyawan   │ <──────────────────────────│  StakeFlow       │
│  (Penerima) │   withdraw kapan saja       │  Vault           │
└─────────────┘                             └──────────────────┘
```

### Alur Detail

#### Alur Pemberi Kerja (Payer):
1. **Hubungkan wallet MiniPay** ke StakeFlow MiniApp
2. **Buat stream payroll** — atur alamat karyawan, token (USDC/cUSD/USDT), jumlah gaji bulanan
3. **Depositkan stablecoin** — dana otomatis disuplai ke Aave V3 di Celo
4. **Pantau dashboard** — lihat semua stream aktif, total deposit, yield yang dihasilkan, sisa saldo
5. **Top up saldo** jika diperlukan — deposit baru juga otomatis di-stake ke Aave

#### Alur Karyawan (Payee):
1. **Hubungkan wallet MiniPay** ke StakeFlow MiniApp
2. **Lihat stream masuk** — lihat gaji bertambah secara real-time (per-detik)
3. **Withdraw kapan saja** — klaim gaji yang sudah terkumpul + yield Aave proporsional
4. **Pantau yield yang didapat** — lihat berapa banyak tambahan yang kamu dapat dari staking

#### Di Balik Layar:
1. Ketika pemberi kerja mendepositkan 10,000 USDC, StakeFlow memanggil `Aave Pool.supply()` → menerima ~10,000 aUSDC
2. Saldo aUSDC bertambah seiring waktu (misal, 1.92% APY untuk USDC di Aave Celo)
3. Ketika karyawan menarik 1,000 USDC gaji, StakeFlow memanggil `Aave Pool.withdraw()` → menukarkan aUSDC kembali ke USDC
4. Karyawan menerima 1,000 USDC (gaji) + bagian yield yang didapat
5. Yield didistribusikan secara proporsional berdasarkan durasi stream dan jumlahnya

---

## Arsitektur Smart Contract

```
┌────────────────────────┐
│  StakeFlowFactory      │  ← Membuat instance StakeFlow per pemberi kerja
│  (CREATE2)             │
└───────────┬────────────┘
            │ deploy
            ▼
┌────────────────────────┐       ┌────────────────────┐
│  StakeFlowVault        │ ────> │  Aave V3 Pool      │
│                        │       │  (Celo Mainnet)    │
│  - createStream()      │       │                    │
│  - deposit()           │       │  Pool:             │
│  - withdraw()          │       │  0x3E59A31363...   │
│  - cancelStream()      │       └────────────────────┘
│  - getBalance()        │
│  - getYieldEarned()    │
│  - streams mapping     │
│  - balances mapping    │
└────────────────────────┘
```

### Fungsi Utama Smart Contract

```solidity
// Fungsi Pemberi Kerja
deposit(address token, uint256 amount)
    → Approve & supply ke Aave V3, update saldo internal

createStream(address payee, address token, uint216 amountPerSec)
    → Buat stream gaji real-time ke karyawan

cancelStream(address payee, address token, uint216 amountPerSec)
    → Hentikan stream, selesaikan jumlah yang tertunda

// Fungsi Karyawan
withdraw(address payer, address token, uint216 amountPerSec)
    → Klaim gaji yang terkumpul + yield dari Aave

// Fungsi View
getBalance(address payer) → (int256)
    → Mengembalikan sisa saldo payer (termasuk yield)

getStreamInfo(bytes32 streamId) → (Stream)
    → Mengembalikan detail stream

getYieldEarned(bytes32 streamId) → (uint256)
    → Mengembalikan yield yang didapat untuk stream tertentu
```

### Token yang Didukung di Celo (Aave V3)

| Token | APY Supply Aave | Alamat aToken |
|-------|----------------|----------------|
| **USDC** | ~1.92% | `0xFF8309b9e99bfd2D4021bc71a362aBD93dBd4785` |
| **USDT** | ~0.50% | `0xDeE98402A302e4D707fB9bf2bac66fAEEc31e8Df` |
| **cUSD (USDm)** | ~1.07% | `0xBba98352628B0B0c4b40583F593fFCb630935a45` |
| **CELO** | ~0.57% | `0xC3e77dC389537Db1EEc7C33B95Cf3beECA71A209` |

> Catatan: Rate APY bersifat variabel dan berubah berdasarkan utilisasi pasar.

### Alamat Kontrak Utama (Celo Mainnet)

| Kontrak | Alamat |
|---------|--------|
| Aave V3 Pool | `0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402` |
| Aave PoolAddressesProvider | `0x9F7Cf9417D5251C59fE94fB9147feEe1aAd9Cea5` |
| USDC (Celo) | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| USDT (Celo) | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` |
| cUSD / USDm (Celo) | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Blockchain** | Celo Mainnet |
| **Smart Contracts** | Solidity ^0.8.0, Hardhat |
| **Integrasi DeFi** | Aave V3 (Celo) |
| **Frontend** | Next.js / React |
| **Wallet** | MiniPay SDK (MiniPay Hook) |
| **Deployment** | Vercel |
| **Starter Kit** | [celo-composer](https://github.com/celo-org/celo-composer) |
| **Stablecoin** | USDC, USDT, cUSD (USDm) |

---

## Fitur

### MVP (Proof of Ship - April 2026)

- [ ] Integrasi wallet MiniPay (MiniPay Hook)
- [ ] Dashboard pemberi kerja — buat & kelola stream payroll
- [ ] Dashboard karyawan — lihat stream gaji & withdraw
- [ ] Streaming gaji real-time (per-detik)
- [ ] Auto-staking deposit ke Aave V3 di Celo
- [ ] Distribusi yield ke karyawan saat withdrawal
- [ ] Dukungan multi-token (USDC, USDT, cUSD)
- [ ] Manajemen stream (buat, jeda, batalkan)
- [ ] Deploy di Celo Mainnet

### Roadmap Masa Depan

- [ ] Batch payroll — import CSV untuk banyak karyawan
- [ ] Dashboard analitik yield untuk pemberi kerja & karyawan
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
- Total deposit & yield yang dihasilkan
- Daftar stream aktif dengan status real-time
- Tombol buat stream baru
- Tombol top up saldo

### 3. Buat Stream
- Input alamat wallet karyawan
- Pilih token (USDC / cUSD / USDT)
- Jumlah gaji bulanan
- Review & konfirmasi → deposit + buat stream

### 4. Dashboard Karyawan
- Stream masuk dengan penghitung akumulasi real-time
- Gaji pokok yang didapat
- Yield yang didapat (dari staking Aave)
- Tombol withdraw

### 5. Withdraw
- Menampilkan total yang bisa diklaim (rincian gaji + yield)
- Withdraw sekali ketuk ke wallet MiniPay

---

## Contoh Skenario

> **Perusahaan ABC** membayar 5 karyawan masing-masing $1,000/bulan dalam USDC di Celo.

| Langkah | Aksi | Detail |
|---------|------|--------|
| 1 | Perusahaan deposit | **5,000 USDC** ke StakeFlow |
| 2 | Auto-stake ke Aave | 5,000 USDC → Aave V3 → menghasilkan **~1.92% APY** |
| 3 | Streaming | Setiap karyawan menerima ~$0.00038/detik |
| 4 | Setelah 1 bulan | Setiap karyawan withdraw **$1,000 USDC** (gaji) |
| 5 | + Yield | Ditambah **~$1.60 USDC** dari yield Aave |
| **Total** | | **$1,001.60 per karyawan** |

- Dalam setahun: tambahan **~$19.20/karyawan** dari yield
- Untuk payroll lebih besar ($100K/bulan): yield menjadi **~$160/bulan**
- Yield bertambah seiring jumlah deposit — semakin besar modal, semakin banyak yang didapat semua orang

---

## Kenapa Celo?

| Keunggulan | Detail |
|------------|--------|
| **Biaya sub-sen** | Ideal untuk micro-withdrawal yang sering dalam streaming |
| **MiniPay** | 14M+ pengguna, channel distribusi bawaan |
| **Mobile-first** | Dirancang untuk pasar berkembang di mana payroll mobile penting |
| **Aave V3** | Infrastruktur DeFi yang terbukti untuk yield, sudah live di Celo |
| **Stablecoin native** | cUSD, USDC, USDT semua tersedia |
| **Finalitas cepat** | ~5 detik block time untuk UX streaming real-time |
| **Kompatibel EVM** | Manfaatkan ekosistem Solidity yang sudah ada |

---

## Memulai (Development)

```bash
# Clone repo
git clone https://github.com/<your-username>/stakeflow.git
cd stakeflow

# Install dependensi
npm install

# Setup variabel environment
cp .env.example .env
# Tambahkan private key (JANGAN PERNAH pakai wallet utama untuk dev!)
# Tambahkan Celo RPC URL
# Tambahkan alamat kontrak Aave V3

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
| Aave V3 Celo | [app.aave.com](https://app.aave.com/?marketName=proto_celo_v3) |
| MiniPay Docs | [docs.celo.org/build-on-minipay](https://docs.celo.org/developer/build-on-minipay/overview) |
| LlamaPay (Referensi) | [llamapay.io](https://llamapay.io/) |
| Telegram | [t.me/proofofship](https://t.me/proofofship) |

---

## Lisensi

MIT — Open Source sesuai syarat eligibilitas Proof of Ship.
