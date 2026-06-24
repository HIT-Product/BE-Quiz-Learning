module.exports = {
    apps: [
        {
            name: 'api',
            script: 'src/server.js',
            instances: 2,
            exec_mode: 'cluster'
        },
        {
            name: 'worker',
            script: 'src/worker.js',
            instances: 2, // 2 worker instance xử lý song song
            exec_mode: 'fork', // worker dùng fork, không dùng cluster
            kill_timeout: 10000 // cho graceful shutdown tối đa 10s trước khi PM2 ép dừng
        }
    ]
}

