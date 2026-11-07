import { e, json } from './html.js'

/** The old views/payment-return.blade.php: closes the checkout popup, or (opened as a full page) opens the app */
export const paymentReturnPage = ({ appUrl }) => `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Payment finished</title>
    <style>
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b1220; color: #e5e7eb; font-family: system-ui, sans-serif; text-align: center; }
        a { color: #22d3ee; }
    </style>
</head>
<body>
    <div>
        <p>Payment finished. You can close this window.</p>
        <p><a href="${e(appUrl)}">Back to Procurement</a></p>
    </div>
    <script>
        // Checkout popup: close it; the Procurement page that opened it shows the result
        if (window.opener && !window.opener.closed) window.close()
        else window.location.replace(${json(appUrl)})
    </script>
</body>
</html>
`
