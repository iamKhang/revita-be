import java.time.LocalDateTime;
import java.util.List;

public class PostCategory {
    private String id;
    private String name;
    private String slug;
    private String coverImage;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String authorId;
    private ContentStatus status;
    
    // Quan hệ nhiều-một
    private Admin author;
    
    // Quan hệ một-nhiều
    private List<PostInCategory> postsInCategory;
    
    public PostCategory() {
    }
}

