module.exports = {
    apps: [
        {
            name: 'api',
            script: 'src/server.js',
            instances: 1,
            exec_mode: 'cluster',
            max_memory_restart: '300M',
            env: {
                NODE_ENV: 'production'
            }
        },
        {
            name: 'worker',
            script: 'src/worker.js',
            instances: 1,
            exec_mode: 'fork', // Worker phải chạy fork, không chạy cluster.
            kill_timeout: 10000, // Cho graceful shutdown tối đa 10 giây.
            max_memory_restart: '150M',
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
}
