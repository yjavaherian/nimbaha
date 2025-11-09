# نیم بها یاب

به کمک این سایت می توانید چک کنید که ایا لینک شما نیم بها محسوب می شود یا خیر؟

## نحوه استفاده

### ۱. استفاده از وب‌سایت

ساده‌ترین راه، استفاده از وب‌سایت است. کافیست به آدرس زیر مراجعه کرده و لینک خود را در آن وارد کنید:

[https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}](https:// ${{ github.repository_owner }}.github.io/${{ github.event.repository.name }})

### ۲. استفاده از فایل IP ها (برای کاربران حرفه‌ای)

ابتدا آخرین لیست IP ها را از [صفحه Releases](https://github.com/${{ github.repository }}/releases) دانلود کرده و سپس از دستور زیر در ترمینال لینوکس یا مک استفاده کنید:

```bash
domain="example.com"; ip=$(dig +short $domain | head -1); if [[ -z "$ip" ]]; then echo "Domain not resolved"; else grep -q "^$ip$" ips.txt && echo "✅ نیم‌بها است" || echo "❌ نیم‌بها نیست"; fi
```