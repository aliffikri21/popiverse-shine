const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Sajikan file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Fungsi otomatis mencari IP Address Wi-Fi Laptop untuk QR Code
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const players = {};

io.on('connection', async (socket) => {
    console.log('Perangkat terhubung:', socket.id);

    const ip = getLocalIP();
    const controllerUrl = `http://${ip}:3000/controller.html`;
    let qrDataUrl = '';
    try {
        qrDataUrl = await QRCode.toDataURL(controllerUrl, {
            width: 250,
            margin: 1,
            color: {
                dark: '#2D3142',
                light: '#FFFFFF'
            }
        });
    } catch (err) {
        console.error('Gagal generate QR Code:', err);
    }

    // Kirim info IP lokal, QR Code lokal base64 & daftar pemain
    socket.emit('server-info', {
        ip,
        port: 3000,
        controllerUrl,
        qrDataUrl,
        players
    });

    // 1. Saat pengunjung menekan "Gabung ke Pulau" di HP
    socket.on('join-island', (userData) => {
        players[socket.id] = {
            id: socket.id,
            name: userData.name || 'Si Gemoy',
            color: userData.color || '#FF6B9D',
            shape: userData.shape || 'sphere',
            x: (Math.random() - 0.5) * 10,
            z: (Math.random() - 0.5) * 10
        };
        io.emit('player-joined', players[socket.id]);
        io.emit('update-count', Object.keys(players).length);
    });

    // 2. Saat pengunjung menggerakkan / melompat / ganti warna dari HP
    socket.on('player-action', (actionData) => {
        if (players[socket.id]) {
            if (actionData.color) players[socket.id].color = actionData.color;
            io.emit('trigger-action', {
                id: socket.id,
                type: actionData.type, // 'jump' | 'dance' | 'color' | 'move'
                color: players[socket.id].color,
                dx: actionData.dx || 0,
                dz: actionData.dz || 0
            });
        }
    });

    // 3. Saat pengunjung menutup browser HP
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            delete players[socket.id];
            io.emit('player-left', socket.id);
            io.emit('update-count', Object.keys(players).length);
        }
    });

    // 4. Reset semua pemain & bot dari layar pameran
    socket.on('reset-all-players', () => {
        for (const id in players) {
            delete players[id];
        }
        io.emit('all-players-cleared');
        io.emit('update-count', 0);
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log('====================================================');
    console.log('🎈 POPIVERSE 3D SERVER AKTIF!');
    console.log(`🖥️  Buka Layar Utama (TV) : http://localhost:${PORT}`);
    console.log(`📱 Buka di HP Pengunjung : http://${ip}:${PORT}/controller.html`);
    console.log('====================================================');
});