import java.time.LocalDateTime;
import java.util.List;

public class Post {
    private String id;
    private String title;
    private String slug;
    private String coverImage;
    private String summary;
    private String content;
    private String authorId;
    private ContentStatus status;
    private boolean isPinned;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<String> tags;
    
    // Quan hệ nhiều-một
    private Admin author;
    
    // Quan hệ một-nhiều
    private List<PostInCategory> inCategories;
    private List<SeriesPost> seriesPosts;
    private List<Comment> comments;
    private List<PostLike> likes;
    
    public Post() {
    }
}

