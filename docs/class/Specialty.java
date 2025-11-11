import java.util.List;

public class Specialty {
    private String id;
    private String specialtyCode;
    private String name;
    private String imgUrl;
    private String description;
    
    // Quan hệ một-nhiều
    private List<ClinicRoom> clinicRooms;
    private List<Appointment> appointments;
    private List<Template> templates;
    private List<Service> services;
    private List<Package> packages;
    private List<Doctor> doctors;
    
    public Specialty() {
    }
}

