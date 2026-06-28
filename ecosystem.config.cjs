module.exports = {
    apps: [
        {
            name: 'api',
            script: 'src/server.js',
            instances: 1,
            exec_mode: 'cluster'
        },
        {
            name: 'worker',
            script: 'src/worker.js',
            instances: 1,
            exec_mode: 'fork', // worker dùng fork, không dùng cluster
            kill_timeout: 10000 // cho graceful shutdown tối đa 10s trước khi PM2 ép dừng
        }
    ]
}

