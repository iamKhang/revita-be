import java.time.LocalDateTime;
import java.util.List;

public class Package {
    private String id;
    private String code;
    private String name;
    private String description;
    private Float price;
    private boolean isActive;
    private boolean requiresDoctor;
    private String categoryId;
    private String specialtyId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Quan hệ nhiều-một
    private ServiceCategory category;
    private Specialty specialty;
    
    // Quan hệ một-nhiều
    private List<PackageItem> items;
    
    public Package() {
    }
}

