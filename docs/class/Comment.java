import java.time.LocalDateTime;
import java.util.List;

public class Comment {
    private String id;
    private String postId;
    private String parentId;
    private String authorId;
    private String content;
    private boolean isEdited;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Quan hệ nhiều-một
    private Post post;
    private Comment parent;
    private Auth author;
    
    // Quan hệ một-nhiều
    private List<Comment> replies;
    private List<CommentLike> likes;
    
    public Comment() {
    }
}

