import java.time.LocalDateTime;
import java.util.List;

public class Auth {
    private String id;
    private String phone;
    private String email;
    private String googleId;
    private String password;
    private String accessToken;
    private String refreshToken;
    private LocalDateTime tokenExpiry;
    private String name;
    private LocalDateTime dateOfBirth;
    private String gender;
    private String avatar;
    private String address;
    private String citizenId;
    private Role role;
    
    // Quan hệ một-một
    private Doctor doctor;
    private Patient patient;
    private Receptionist receptionist;
    private Admin admin;
    private Cashier cashier;
    private Technician technician;
    
    // Quan hệ một-nhiều
    private List<Comment> comments;
    private List<PostLike> likes;
    private List<CommentLike> commentLikes;
    
    public Auth() {
    }
}

