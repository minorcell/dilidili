use std::sync::OnceLock;
use std::time::Duration;

// 用户代理
pub const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

/// 进程内共享的 HTTP 客户端。
///
/// 之前每个 API 调用都会新建一个 Client，导致每次都要重新做 DNS/TCP/TLS
/// 握手；登录页每 2 秒轮询一次时尤其明显。共享客户端可以复用连接池。
pub fn client() -> &'static reqwest::Client {
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .connect_timeout(Duration::from_secs(10))
            .pool_idle_timeout(Duration::from_secs(90))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}
