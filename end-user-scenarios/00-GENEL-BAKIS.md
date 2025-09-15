# Son Kullanıcı Senaryoları: Blicence Platformu

Bu döküman, `Blicence` platformunun temel kullanım senaryolarını son kullanıcı (müşteri) ve üretici (hizmet sağlayıcı) perspektifinden açıklamaktadır.

## Ana Konseptler

- **Producer (Üretici):** Platform üzerinden hizmet veya ürün sunan işletme, geliştirici veya içerik üreticisi. (Örnek: Bir spor salonu, bir SaaS şirketi, bir online eğitim platformu).
- **Customer (Müşteri):** Üreticilerin sunduğu hizmetleri satın alan son kullanıcı.
- **Plan:** Bir üreticinin sunduğu hizmet paketidir. Farklı türleri olabilir:
    - **Kullandıkça Öde (nUsage):** Müşterinin belirli bir kullanım hakkı (kontör) satın aldığı model. (Örnek: 10 derslik spor salonu üyeliği).
    - **Abonelik (API/Vesting):** Müşterinin belirli bir süre boyunca hizmete erişim sağladığı model. (Örnek: Aylık 10$ karşılığında bir yazılıma erişim).
- **Ödeme Akışı (Stream):** Müşterinin yaptığı ödemenin tamamının tek seferde üreticiye geçmesi yerine, zamanla yavaş yavaş aktarılmasıdır. Bu, müşteriye aboneliğini istediği zaman iptal etme ve kullanmadığı hizmetin parasını geri alma güvencesi verir.

Aşağıda, bu konseptlerin gerçek hayattaki uygulamalarını gösteren senaryolar bulunmaktadır.
