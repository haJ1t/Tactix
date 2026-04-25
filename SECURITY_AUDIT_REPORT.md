# Tactix Güvenlik Denetimi Raporu

## Denetim Kapsamı

| Bileşen | Dosya Sayısı | Satır Sayısı |
|---------|-------------|--------------|
| Backend (Flask API) | 43 | 7,064 |
| Frontend (React/Vite) | 79 | 7,210 |
| Scripts (Python) | 21 | 7,427 |
| **Toplam** | **143** | **21,701** |

---

## KRİTİK SEVERİTE (5 Bulgu)

### 1. Kimlik Doğrulama ve Yetkilendirme Eksikliği
- **Konum:** Tüm API endpoint'leri (`backend/api/*.py`)
- **Risk:** KRİTİK
- **Açıklama:** Uygulamada **hiçbir kimlik doğrulama mekanizması yok**. JWT, session cookie, API key, OAuth - hiçbiri yok. Her endpoint tamamen açık.
- **Etki:** Herhangi bişey pahalı ML analizi tetikleyebilir, raporları silebilir, PDF'leri indirebilir, tüm maç verilerine erişebilir.

### 2. CORS Wildcard Origin
- **Konum:** `backend/app.py:28`
- **Kod:** `CORS(app, resources={r"/api/*": {"origins": "*"}})`
- **Risk:** KRİTİK
- **Açıklama:** CORS tüm origin'lere izin veriyor. Kötü niyetli bir web sitesi, kullanıcı Tactix API'sine erişebilirken cross-origin istekler yapabilir.

### 3. SQL Enjeksiyonu (Schema Upgrades)
- **Konum:** `backend/models/__init__.py:63, 85-86, 91`
- **Kod:**
  ```python
  f"PRAGMA table_info({table_name})"
  f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"
  ```
- **Risk:** YÜKSEK
- **Açıklama:** f-string ile SQL sorguları oluşturuluyor. Şu an hardcoded dictionary'lerden geliyor ama bu desen tehlikeli. Dictionary'ler dışarıdan beslenirse doğrudan SQL enjeksiyonu.

### 4. Path Traversal (PDF İndirme)
- **Konum:** `backend/api/report_routes.py:98-115`
- **Risk:** YÜKSEK
- **Açıklama:** `report.pdf_path` veritabanından geliyor ve `send_file()` ile doğrudan kullanılıyor. Veritabanı ele geçirilirse, `pdf_path` manipüle edilerek sistemdeki herhangi bir dosya okunabilir.

### 5. Unsafe Joblib Deserialization (RCE)
- **Konum:**
  - `backend/services/ml/pass_difficulty_model.py:231`
  - `backend/services/ml/tactical_classifier.py:636`
  - `backend/services/ml/vaep_model.py:292`
- **Risk:** YÜKSEK
- **Açıklama:** `joblib.load()` pickle kullanır. Model dosyaları değiştirilirse (örneğin `models/trained/` dizinine zararlı dosya konursa), uzaktan kod çalıştırma (RCE) mümkün.

---

## YÜKSEK SEVERİTE (4 Bulgu)

### 6. Zayıf Varsayılan Secret Key
- **Konum:** `backend/config.py:11`
- **Kod:** `SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')`
- **Risk:** YÜKSEK
- **Açıklama:** Ortam değişkeni ayarlanmazsa tahmin edilebilir bir secret kullanılır. Session forgery, cookie manipulation riski.

### 7. Debug Mod Varsayılan Yapılandırma
- **Konum:** `backend/config.py:20, 29`
- **Kod:** `class DevelopmentConfig: DEBUG = True; default: DevelopmentConfig`
- **Risk:** YÜKSEK
- **Açıklama:** Varsayılan yapılandırma DevelopmentConfig. WSGI sunucusuyla çalıştırılırsa debug mod açık kalır, detaylı hata sayfaları ve interaktif debugger açığa çıkar.

### 8. Hata Mesajlarıyla Bilgi Sızdırma
- **Konum:** `backend/api/report_routes.py:66-70, 89-93`
- **Kod:** `return jsonify({'error': f'Report generation failed: {error}'}), 500`
- **Risk:** YÜKSEK-ORTA
- **Açıklama:** Ham exception mesajları istemciye dönülüyor. Dahili dosya yolları, veritabanı yapısı, implementasyon detayları sızdırılabilir.

### 9. Komut Enjeksiyonu (Sync Script)
- **Konum:** `scripts/sync_agency_agents.py:529-532`
- **Risk:** YÜKSEK
- **Açıklama:** Kullanıcı kontrollü `repo_url` ve `branch` parametreleri `subprocess.run()`'a doğrudan aktarılıyor. Script çalıştırma yetkisi olan bir saldırgan zararlı repo URL'leri verebilir.

---

## ORTA SEVERİTE (9 Bulgu)

### 10. Sınırsız Limit Parametresi (DoS)
- **Konum:** `backend/api/analysis_routes.py:136`
- **Kod:** `limit = request.args.get('limit', default=5, type=int)`
- **Risk:** ORTA
- **Açıklama:** `?limit=999999` gibi bir istek bellek tüketimine yol açabilir. Üst sınır yok.

### 11. Doğrulanmamış Metric Parametresi
- **Konum:** `backend/api/analysis_routes.py:134-147`
- **Kod:** `getattr(NetworkMetrics, metric)`
- **Risk:** ORTA
- **Açıklama:** `metric` parametresi beyaz liste yok. SQLAlchemy'nin iç özniteliklerine/metodlarına erişim riski.

### 12. Rate Limiting Eksikliği
- **Konum:** Tüm API endpoint'leri
- **Risk:** ORTA
- **Açıklama:** Hiçbir endpoint'te rate limiting yok. `/analyze-ml` gibi pahalı endpoint'lere sınırsız istek atılabilir.

### 13. Güvenlik Header'ları Eksikliği
- **Konum:** `backend/app.py`, `frontend/index.html`
- **Risk:** ORTA
- **Açıklama:** CSP, X-Frame-Options, X-Content-Type-Options, HSTS gibi güvenlik header'ları yok.

### 14. HTTPS Zorlaması Yok
- **Konum:** `backend/app.py`
- **Risk:** ORTA
- **Açıklama:** Tüm trafik şifrelenmemiş HTTP üzerinden.

### 15. Path Traversal (Data Parser)
- **Konum:** `backend/services/data_parser.py:27-32, 45-48, 83, 160`
- **Risk:** ORTA
- **Açıklama:** `match_id` JSON'dan gelip doğrudan dosya yolunda kullanılıyor. Veri manipüle edilirse path traversal mümkün.

### 16. Zafiyetli Frontend Bağımlılıkları
- **Konum:** `frontend/package.json`
- **Risk:** ORTA
- **Açıklama:**
  - `axios ^1.6.5` → CVE-2024-39338 (SSRF)
  - `dompurify` → XSS zafiyetleri
  - `esbuild` → Dev server güvenlik açığı
  - `follow-redirects` → Auth header leakage
  - `lodash` → Prototype pollution
  - `picomatch` → ReDoS
  - `rollup` → Path traversal

### 17. Content Security Policy Eksikliği
- **Konum:** `frontend/index.html`
- **Risk:** ORTA
- **Açıklama:** CSP meta tag veya header yok. XSS saldırısı durumunda enjekte edilen script kısıtlama olmadan çalışır.

### 18. Console Error Logging (Production)
- **Konum:** `frontend/src/services/api.ts:15`
- **Kod:** `console.error('API Error:', error.response?.data || error.message)`
- **Risk:** DÜŞÜK-ORTA
- **Açıklama:** Backend hata detayları browser console'a yazılıyor.

---

## DÜŞÜK SEVERİTE (6 Bulgu)

### 19. Veritabanı Şifreleme Yok
- **Konum:** `backend/models/__init__.py:11`
- **Risk:** DÜŞÜK
- **Açıklama:** SQLite veritabanı plaintext olarak saklanıyor.

### 20. Bağlantı Havuzu Sınırı Yok
- **Konum:** `backend/models/__init__.py:14`
- **Kod:** `create_engine(DATABASE_URL, echo=False)`
- **Risk:** DÜŞÜK
- **Açıklama:** Yüksek yükte file descriptor tüketimi riski.

### 21. Örnek Config'te Placeholder Secret
- **Konum:** `.env.example:5`
- **Kod:** `SECRET_KEY=your-secret-key-change-in-production`
- **Risk:** DÜŞÜK
- **Açıklama:** Geliştiriciler değiştirmeden kopyalayabilir.

### 22. Hardcoded Kullanıcı Adı
- **Konum:** `frontend/src/components/layout/AppLayout.tsx:15`
- **Kod:** `userName="Halil"`
- **Risk:** DÜŞÜK
- **Açıklama:** Çok kullanıcılı kullanıma hazır olmadığını gösteriyor.

### 23. localStorage Kullanımı
- **Konum:** `frontend/src/shared/lib/reports-storage.ts`
- **Risk:** DÜŞÜK
- **Açıklama:** Rapor verileri localStorage'da. Aynı origin'deki herhangi bir JS okuyabilir.

### 24. Eski Bağımlılık Sürümleri
- **Konum:** `requirements.txt`
- **Risk:** DÜŞÜK
- **Açıklama:** `flask==3.0.0`, `requests==2.31.0` gibi zafiyetli sürümler pinlenmiş. Kurulu sürümler daha yeni.

---

## Olumlu Güvenlik Notları

- ✅ `dangerouslySetInnerHTML` kullanımı yok
- ✅ `eval()` veya `Function()` constructor kullanımı yok
- ✅ `innerHTML` DOM ataması yok
- ✅ Dosya yükleme fonksiyonelliği yok (attack surface az)
- ✅ iframe veya postMessage kullanımı yok
- ✅ SQLAlchemy ORM kullanılıyor (çoğu SQL enjeksiyonunu engeller)
- ✅ Girdi parametreleri int'e cast ediliyor
- ✅ PDF oluşturma XML escaping kullanıyor (`_escape_text`)
- ✅ `shell=True` kullanımı yok
- ✅ `pickle.load()` çağrısı yok
- ✅ SSL doğrulaması devre dışı bırakılmamış
- ✅ Hardcoded credential veya API key yok
- ✅ Veritabanı session'ları `finally` bloklarında kapatılıyor
- ✅ `start_tactix.sh` strict error handling kullanıyor

---

## Özet

| Seviye | Sayı |
|--------|------|
| Kritik | 5 |
| Yüksek | 4 |
| Orta | 9 |
| Düşük | 6 |
| **Toplam** | **24** |

**Sonuç:** Uygulama yerel geliştirme için uygundur ancak **üretim ortamına alınmamalıdır**. Kimlik doğrulama katmanı tamamen eksik, CORS aşırı izin verici ve birkaç tehlikeli desen mevcuttur. Önemli güvenlik sertleştirmesi gereklidir.
