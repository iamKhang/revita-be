import java.time.LocalDateTime;

public class PostLike {
    private String postId;
    private String userId;
    private LocalDateTime createdAt;
    
    // Quan hệ nhiều-một
    private Post post;
    private Auth user;
    
    public PostLike() {
    }
}

