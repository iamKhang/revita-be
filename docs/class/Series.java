import java.time.LocalDateTime;
import java.util.List;

public class Series {
    private String id;
    private String name;
    private String coverImage;
    private String authorId;
    private String slug;
    private ContentStatus status;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Quan hệ nhiều-một
    private Admin author;
    
    // Quan hệ một-nhiều
    private List<SeriesPost> seriesPosts;
    
    public Series() {
    }
}

