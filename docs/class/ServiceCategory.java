import java.util.List;

public class ServiceCategory {
    private String id;
    private String code;
    private String name;
    private String description;
    
    // Quan hệ một-nhiều
    private List<Service> services;
    private List<Package> packages;
    
    public ServiceCategory() {
    }
}

