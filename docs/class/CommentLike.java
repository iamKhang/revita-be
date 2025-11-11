import java.time.LocalDateTime;

public class CommentLike {
    private String commentId;
    private String userId;
    private LocalDateTime createdAt;
    
    // Quan hệ nhiều-một
    private Comment comment;
    private Auth user;
    
    public CommentLike() {
    }
}

