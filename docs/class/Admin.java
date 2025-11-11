import java.util.List;

public class Admin {
    private String id;
    private String adminCode;
    private String authId;
    private boolean isActive;
    private String position;
    
    // Quan hệ nhiều-một
    private Auth auth;
    
    // Quan hệ một-nhiều
    private List<Post> posts;
    private List<PostCategory> categories;
    private List<Series> series;
    
    public Admin() {
    }
}

